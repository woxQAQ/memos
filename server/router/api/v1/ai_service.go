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
	for _, message := range request.Messages {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    message.Role,
			Content: message.Content,
		})
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

		if err := stream.Send(&v1pb.GenerateContentResponse{
			Content: content,
		}); err != nil {
			return status.Errorf(codes.Internal, "failed to send response to client: %v", err)
		}
	}

	// Create session if needed and save messages if AI response is successful
	if assistantResponse.Len() > 0 {
		// If no session exists, create one automatically
		if session == nil {
			now := time.Now().Unix()
			newSession, err := s.Store.CreateChatSession(ctx, &store.ChatSession{
				CreatorID: user.ID,
				CreatedTs: now,
				UpdatedTs: now,
				Title:     "New Conversation", // Will be updated with first user message content
				Status:    "ACTIVE",
			})
			if err != nil {
				// Log error but don't fail the entire request since AI response was successful
				fmt.Printf("Warning: failed to create new session: %v\n", err)
			} else {
				session = newSession
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

			// Save assistant response
			_, err := s.Store.CreateChatMessage(ctx, &store.ChatMessage{
				SessionID: session.ID,
				CreatedTs: time.Now().Unix(),
				Role:      "assistant",
				Content:   assistantResponse.String(),
			})
			if err != nil {
				fmt.Printf("Warning: failed to save assistant message: %v\n", err)
			} else {
				// Update session timestamp and title if this is the first conversation
				updateData := &store.UpdateChatSession{
					UID: session.UID,
				}

				// If this is a new session, set title based on first user message
				if session.Title == "New Conversation" && len(request.Messages) > 0 {
					firstUserMessage := request.Messages[0].Content
					if len(firstUserMessage) > 50 {
						firstUserMessage = firstUserMessage[:50] + "..."
					}
					updateData.Title = &firstUserMessage
				}

				_, err = s.Store.UpdateChatSession(ctx, updateData)
				if err != nil {
					fmt.Printf("Warning: failed to update session: %v\n", err)
				}
			}
		}
	}

	return nil
}

func (s *APIV1Service) ListChatSessions(ctx context.Context, request *v1pb.ListChatSessionsRequest) (*v1pb.ListChatSessionsResponse, error) {
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

// Helper functions
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
