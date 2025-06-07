package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ChatSession represents a chat session.
type ChatSession struct {
	ID        int32          `json:"id"`
	UID       string         `json:"uid"`
	CreatorID int32          `json:"creatorId"`
	CreatedTs int64          `json:"createdTs"`
	UpdatedTs int64          `json:"updatedTs"`
	Title     string         `json:"title"`
	Status    string         `json:"status"`
	Messages  []*ChatMessage `json:"messages,omitempty"`
}

// ChatMessage represents a message in a chat session.
type ChatMessage struct {
	ID        int32  `json:"id"`
	SessionID int32  `json:"sessionId"`
	CreatedTs int64  `json:"createdTs"`
	Role      string `json:"role"`
	Content   string `json:"content"`
}

type FindChatSession struct {
	ID        *int32
	UID       *string
	CreatorID *int32
	Status    *string
}

type UpdateChatSession struct {
	UID   string
	Title *string
}

type FindChatMessage struct {
	SessionID *int32
}

// CreateChatSession creates a new chat session.
func (s *Store) CreateChatSession(ctx context.Context, create *ChatSession) (*ChatSession, error) {
	if create.UID == "" {
		create.UID = uuid.New().String()
	}
	if create.Title == "" {
		create.Title = fmt.Sprintf("Chat %s", time.Unix(create.CreatedTs, 0).Format("2006-01-02 15:04"))
	}
	return s.driver.CreateChatSession(ctx, create)
}

// ListChatSessions lists chat sessions.
func (s *Store) ListChatSessions(ctx context.Context, find *FindChatSession) ([]*ChatSession, error) {
	return s.driver.ListChatSessions(ctx, find)
}

// GetChatSession gets a chat session by find condition.
func (s *Store) GetChatSession(ctx context.Context, find *FindChatSession) (*ChatSession, error) {
	return s.driver.GetChatSession(ctx, find)
}

// UpdateChatSession updates a chat session.
func (s *Store) UpdateChatSession(ctx context.Context, update *UpdateChatSession) (*ChatSession, error) {
	return s.driver.UpdateChatSession(ctx, update)
}

// DeleteChatSession deletes a chat session.
func (s *Store) DeleteChatSession(ctx context.Context, find *FindChatSession) error {
	return s.driver.DeleteChatSession(ctx, find)
}

// CreateChatMessage creates a new chat message.
func (s *Store) CreateChatMessage(ctx context.Context, create *ChatMessage) (*ChatMessage, error) {
	return s.driver.CreateChatMessage(ctx, create)
}

// ListChatMessages lists chat messages for a session.
func (s *Store) ListChatMessages(ctx context.Context, find *FindChatMessage) ([]*ChatMessage, error) {
	return s.driver.ListChatMessages(ctx, find)
}
