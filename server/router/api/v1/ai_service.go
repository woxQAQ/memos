package v1

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	openai "github.com/sashabaranov/go-openai"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// AIService implements the AI service.
type AIService struct {
}

// NewAIService creates a new AI service.
func NewAIService() *AIService {
	return &AIService{}
}

func (s *APIV1Service) GenerateContent(request *v1pb.GenerateContentRequest, stream v1pb.AIService_GenerateContentServer) error {
	ctx := stream.Context()
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return status.Errorf(codes.Unauthenticated, "Please sign in to use AI features")
	}
	if len(request.Messages) == 0 {
		return status.Errorf(codes.InvalidArgument, "messages are required")
	}

	aiModelSetting, err := s.Store.GetWorkspaceAIModelSetting(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get workspace AI model setting: %v", err)
	}
	if aiModelSetting == nil || aiModelSetting.Model == "" || aiModelSetting.ApiKey == "" || aiModelSetting.BaseUrl == "" {
		return status.Errorf(codes.FailedPrecondition, "AI configuration is not set up. Please configure API key, model, and base URL in workspace settings. Contact your administrator to set up AI configuration.")
	}

	// Handle session if provided
	var session *store.ChatSession
	if request.SessionUid != "" {
		session, err = s.Store.GetChatSession(ctx, &store.FindChatSession{
			UID:       &request.SessionUid,
			CreatorID: &user.ID,
		})
		if err != nil {
			return status.Errorf(codes.Internal, "failed to get chat session: %v", err)
		}
		if session == nil {
			return status.Errorf(codes.NotFound, "chat session not found")
		}
	}

	// Note: We'll save messages only after successful AI response

	config := openai.DefaultConfig(aiModelSetting.ApiKey)
	config.BaseURL = aiModelSetting.BaseUrl
	client := openai.NewClientWithConfig(config)

	var messages []openai.ChatCompletionMessage

	// Add system message for new conversations to auto-generate titles
	isNewConversation := session == nil
	if isNewConversation && len(request.Messages) > 0 {
		systemPrompt := `You are a helpful AI assistant. For the first message in a conversation, you must follow this exact format:

1. Answer the user's question completely and naturally
2. Add exactly two line breaks
3. Add "CONVERSATION_TITLE: " followed by a 2-6 word title that captures the essence of the conversation

IMPORTANT: The title should be concise, descriptive, and without quotes. Always include "CONVERSATION_TITLE: " exactly as shown.

Example format:
[Your complete answer to the user's question goes here. This can be multiple paragraphs and as long as needed.]

CONVERSATION_TITLE: Python Data Analysis

Remember: Only add the title for the first response in a new conversation.`

		messages = append(messages, openai.ChatCompletionMessage{
			Role:    "system",
			Content: systemPrompt,
		})
	}

	for _, message := range request.Messages {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    message.Role,
			Content: message.Content,
		})
	}

	// Send MODEL_READY event
	if err := stream.Send(&v1pb.GenerateContentResponse{
		EventType: v1pb.StreamEventType_MODEL_READY,
		Message:   "AI model is ready to generate content",
	}); err != nil {
		return status.Errorf(codes.Internal, "failed to send model ready event: %v", err)
	}

	model := aiModelSetting.Model
	respStream, err := client.CreateChatCompletionStream(ctx, openai.ChatCompletionRequest{
		Model:    model,
		Messages: messages,
		Stream:   true,
	})
	if err != nil {
		// Check for authentication errors
		if strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "Unauthorized") ||
			strings.Contains(err.Error(), "invalid api key") || strings.Contains(err.Error(), "authentication") {
			return status.Errorf(codes.Unauthenticated, "Invalid API key. Please check your OpenAI API key in workspace settings")
		}
		// Check for rate limit errors
		if strings.Contains(err.Error(), "429") || strings.Contains(err.Error(), "rate limit") {
			return status.Errorf(codes.ResourceExhausted, "Rate limit exceeded. Please try again later")
		}
		// Check for quota errors
		if strings.Contains(err.Error(), "quota") || strings.Contains(err.Error(), "billing") {
			return status.Errorf(codes.FailedPrecondition, "API quota exceeded or billing issue. Please check your OpenAI account")
		}
		return status.Errorf(codes.Internal, "AI service error: %v", err)
	}
	defer respStream.Close()

	// Collect assistant response for saving to session
	var assistantResponse strings.Builder
	var createdSession *store.ChatSession
	var extractedTitle string
	var cleanContent strings.Builder

	for {
		response, err := respStream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			// Check for authentication errors during streaming
			if strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "Unauthorized") ||
				strings.Contains(err.Error(), "invalid api key") || strings.Contains(err.Error(), "authentication") {
				return status.Errorf(codes.Unauthenticated, "Invalid API key. Please check your OpenAI API key in workspace settings")
			}
			return status.Errorf(codes.Internal, "failed to receive from chat completion stream: %v", err)
		}

		content := response.Choices[0].Delta.Content
		assistantResponse.WriteString(content)

		// Check if we've detected a title in the stream
		fullContent := assistantResponse.String()
		if strings.Contains(fullContent, "CONVERSATION_TITLE:") && extractedTitle == "" {
			// Split content and title
			parts := strings.Split(fullContent, "CONVERSATION_TITLE:")
			if len(parts) == 2 {
				contentPart := strings.TrimSpace(parts[0])
				titlePart := strings.TrimSpace(parts[1])

				// Extract and clean the title (remove any trailing content)
				titleLines := strings.Split(titlePart, "\n")
				if len(titleLines) > 0 {
					extractedTitle = strings.TrimSpace(titleLines[0])
					fmt.Printf("Title extracted from stream: %s\n", extractedTitle)

					// Send any remaining content up to the title marker
					previousContent := cleanContent.String()
					if len(contentPart) > len(previousContent) {
						newContent := contentPart[len(previousContent):]
						if newContent != "" {
							cleanContent.WriteString(newContent)
							if err := stream.Send(&v1pb.GenerateContentResponse{
								EventType: v1pb.StreamEventType_CONTENT,
								Content:   newContent,
							}); err != nil {
								return status.Errorf(codes.Internal, "failed to send response to client: %v", err)
							}
						}
					}
				}
			}
		} else if extractedTitle == "" {
			// Normal content streaming (no title detected yet)
			cleanContent.WriteString(content)
			if err := stream.Send(&v1pb.GenerateContentResponse{
				EventType: v1pb.StreamEventType_CONTENT,
				Content:   content,
			}); err != nil {
				return status.Errorf(codes.Internal, "failed to send response to client: %v", err)
			}
		}
		// If title already extracted, don't send any more content (it's probably part of the title)
	}

	// Send OUTPUT_COMPLETE event
	if err := stream.Send(&v1pb.GenerateContentResponse{
		EventType: v1pb.StreamEventType_OUTPUT_COMPLETE,
		Message:   "Content generation completed",
	}); err != nil {
		return status.Errorf(codes.Internal, "failed to send output complete event: %v", err)
	}

	// Create session if needed and save messages if AI response is successful
	finalContent := assistantResponse.String()
	if len(finalContent) > 0 {
		// Clean the content for storage (remove title if present)
		contentToStore := finalContent
		if extractedTitle != "" {
			parts := strings.Split(finalContent, "CONVERSATION_TITLE:")
			if len(parts) == 2 {
				contentToStore = strings.TrimSpace(parts[0])
			}
		}

		// If no session exists, create one automatically
		if session == nil {
			now := time.Now().Unix()

			// Use extracted title or fallback
			title := "New Conversation"
			if extractedTitle != "" {
				title = extractedTitle
			}

			newSession, err := s.Store.CreateChatSession(ctx, &store.ChatSession{
				CreatorID: user.ID,
				CreatedTs: now,
				UpdatedTs: now,
				Title:     title,
				Status:    "ACTIVE",
			})
			if err != nil {
				// Log error but don't fail the entire request since AI response was successful
				fmt.Printf("Warning: failed to create new session: %v\n", err)
			} else {
				session = newSession
				createdSession = newSession
			}
		}

		// Save messages to session if we have one
		if session != nil {
			// Save all user messages first
			for _, message := range request.Messages {
				if message.Role == "user" {
					_, err := s.Store.CreateChatMessage(ctx, &store.ChatMessage{
						SessionID: session.ID,
						CreatedTs: time.Now().Unix(),
						Role:      message.Role,
						Content:   message.Content,
					})
					if err != nil {
						fmt.Printf("Warning: failed to save user message: %v\n", err)
					}
				}
			}

			// Save assistant response (clean content without title)
			_, err := s.Store.CreateChatMessage(ctx, &store.ChatMessage{
				SessionID: session.ID,
				CreatedTs: time.Now().Unix(),
				Role:      "assistant",
				Content:   contentToStore,
			})
			if err != nil {
				fmt.Printf("Warning: failed to save assistant message: %v\n", err)
			} else {
				// Update session timestamp
				_, err = s.Store.UpdateChatSession(ctx, &store.UpdateChatSession{
					UID: session.UID,
				})
				if err != nil {
					fmt.Printf("Warning: failed to update session timestamp: %v\n", err)
				}

				// Send title generated event if we have an extracted title
				if createdSession != nil && extractedTitle != "" {
					if err := stream.Send(&v1pb.GenerateContentResponse{
						EventType: v1pb.StreamEventType_TITLE_GENERATED,
						Session:   convertChatSessionToPb(createdSession),
						Message:   fmt.Sprintf("Title generated: %s", extractedTitle),
					}); err != nil {
						fmt.Printf("Warning: failed to send title generated event: %v\n", err)
					}
				} else if createdSession != nil && extractedTitle == "" {
					// Fallback: generate title using traditional method if not extracted from stream
					fmt.Printf("No title extracted from stream, using fallback method for session %s\n", createdSession.UID)
					go s.generateAndUpdateSessionTitle(context.Background(), createdSession, request.Messages, contentToStore, aiModelSetting, stream)
				}
			}
		}
	}

	// Send SESSION_UPDATED event if a new session was created
	if createdSession != nil {
		if err := stream.Send(&v1pb.GenerateContentResponse{
			EventType: v1pb.StreamEventType_SESSION_UPDATED,
			Session:   convertChatSessionToPb(createdSession),
			Message:   "New session created",
		}); err != nil {
			return status.Errorf(codes.Internal, "failed to send session response to client: %v", err)
		}
	}

	// Send OUTPUT_END event to indicate the stream is ending
	if err := stream.Send(&v1pb.GenerateContentResponse{
		EventType: v1pb.StreamEventType_OUTPUT_END,
		Message:   "Stream ended",
	}); err != nil {
		return status.Errorf(codes.Internal, "failed to send output end event: %v", err)
	}

	return nil
}

// generateAndUpdateSessionTitle generates a concise title for the session using AI.
func (s *APIV1Service) generateAndUpdateSessionTitle(ctx context.Context, session *store.ChatSession, userMessages []*v1pb.ChatMessage, assistantResponse string, aiModelSetting *storepb.WorkspaceAIModelSetting, stream v1pb.AIService_GenerateContentServer) {
	fmt.Printf("Starting title generation for session %s\n", session.UID)
	// Create a prompt to generate a concise title
	userContent := ""
	if len(userMessages) > 0 {
		userContent = userMessages[0].Content
	}

	titlePrompt := fmt.Sprintf(`Generate a short, descriptive title for this conversation. Use 2-5 words, no quotes, be specific about the topic:

User: %s
Assistant: %s

Title:`, userContent, assistantResponse)

	config := openai.DefaultConfig(aiModelSetting.ApiKey)
	config.BaseURL = aiModelSetting.BaseUrl
	client := openai.NewClientWithConfig(config)

	fmt.Printf("Sending title generation request for session %s\n", session.UID)
	resp, err := client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: aiModelSetting.Model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    "user",
				Content: titlePrompt,
			},
		},
		MaxTokens:   30,
		Temperature: 0.3,
	})

	if err != nil {
		fmt.Printf("Warning: failed to generate title for session %s: %v\n", session.UID, err)
		return
	}

	if len(resp.Choices) == 0 || resp.Choices[0].Message.Content == "" {
		fmt.Printf("Warning: empty title response\n")
		return
	}

	// Clean up the generated title
	title := strings.TrimSpace(resp.Choices[0].Message.Content)
	title = strings.Trim(title, `"'`)
	if len(title) > 60 {
		title = title[:60] + "..."
	}
	if title == "" {
		title = "New Conversation"
	}

	// Update the session title
	updatedSession, err := s.Store.UpdateChatSession(ctx, &store.UpdateChatSession{
		UID:   session.UID,
		Title: &title,
	})
	if err != nil {
		fmt.Printf("Warning: failed to update session title: %v\n", err)
	} else {
		fmt.Printf("Generated title for session %s: %s\n", session.UID, title)

		// Send TITLE_GENERATED event
		if stream != nil {
			stream.Send(&v1pb.GenerateContentResponse{
				EventType: v1pb.StreamEventType_TITLE_GENERATED,
				Session:   convertChatSessionToPb(updatedSession),
				Message:   fmt.Sprintf("Title generated: %s", title),
			})
		}
	}
}

func (s *APIV1Service) ListChatSessions(ctx context.Context, _ *v1pb.ListChatSessionsRequest) (*v1pb.ListChatSessionsResponse, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "Please sign in to use AI features")
	}

	sessions, err := s.Store.ListChatSessions(ctx, &store.FindChatSession{
		CreatorID: &user.ID,
		Status:    stringPtr("ACTIVE"),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list chat sessions: %v", err)
	}

	var pbSessions []*v1pb.ChatSession
	for _, session := range sessions {
		pbSession := convertChatSessionToPb(session)
		pbSessions = append(pbSessions, pbSession)
	}

	return &v1pb.ListChatSessionsResponse{
		Sessions: pbSessions,
	}, nil
}

func (s *APIV1Service) GetChatSession(ctx context.Context, request *v1pb.GetChatSessionRequest) (*v1pb.ChatSession, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	session, err := s.Store.GetChatSession(ctx, &store.FindChatSession{
		UID:       &request.Uid,
		CreatorID: &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get chat session: %v", err)
	}
	if session == nil {
		return nil, status.Errorf(codes.NotFound, "chat session not found")
	}

	return convertChatSessionToPb(session), nil
}

func (s *APIV1Service) UpdateChatSession(ctx context.Context, request *v1pb.UpdateChatSessionRequest) (*v1pb.UpdateChatSessionResponse, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Verify session ownership
	session, err := s.Store.GetChatSession(ctx, &store.FindChatSession{
		UID:       &request.Uid,
		CreatorID: &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get chat session: %v", err)
	}
	if session == nil {
		return nil, status.Errorf(codes.NotFound, "chat session not found")
	}

	updatedSession, err := s.Store.UpdateChatSession(ctx, &store.UpdateChatSession{
		UID:   request.Uid,
		Title: &request.Title,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update chat session: %v", err)
	}

	return &v1pb.UpdateChatSessionResponse{
		Session: convertChatSessionToPb(updatedSession),
	}, nil
}

func (s *APIV1Service) DeleteChatSession(ctx context.Context, request *v1pb.DeleteChatSessionRequest) (*v1pb.DeleteChatSessionResponse, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Verify session ownership
	session, err := s.Store.GetChatSession(ctx, &store.FindChatSession{
		UID:       &request.Uid,
		CreatorID: &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get chat session: %v", err)
	}
	if session == nil {
		return nil, status.Errorf(codes.NotFound, "chat session not found")
	}

	err = s.Store.DeleteChatSession(ctx, &store.FindChatSession{
		UID: &request.Uid,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete chat session: %v", err)
	}

	return &v1pb.DeleteChatSessionResponse{}, nil
}

// Helper functions.
func convertChatSessionToPb(session *store.ChatSession) *v1pb.ChatSession {
	pbSession := &v1pb.ChatSession{
		Uid:         session.UID,
		Title:       session.Title,
		CreatedTime: timestamppb.New(time.Unix(session.CreatedTs, 0)),
		UpdatedTime: timestamppb.New(time.Unix(session.UpdatedTs, 0)),
		Status:      session.Status,
	}

	for _, message := range session.Messages {
		pbMessage := &v1pb.ChatMessage{
			Role:        message.Role,
			Content:     message.Content,
			CreatedTime: timestamppb.New(time.Unix(message.CreatedTs, 0)),
		}
		pbSession.Messages = append(pbSession.Messages, pbMessage)
	}

	return pbSession
}

func stringPtr(s string) *string {
	return &s
}
