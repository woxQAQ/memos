package sqlite

import (
	"context"
	"strings"
	"time"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateChatSession(ctx context.Context, create *store.ChatSession) (*store.ChatSession, error) {
	stmt := `
		INSERT INTO chat_session (
			uid, creator_id, created_ts, updated_ts, title, status
		)
		VALUES (?, ?, ?, ?, ?, ?)
		RETURNING id, uid, creator_id, created_ts, updated_ts, title, status
	`
	var chatSession store.ChatSession
	if err := d.db.QueryRowContext(ctx, stmt,
		create.UID,
		create.CreatorID,
		create.CreatedTs,
		create.UpdatedTs,
		create.Title,
		create.Status,
	).Scan(
		&chatSession.ID,
		&chatSession.UID,
		&chatSession.CreatorID,
		&chatSession.CreatedTs,
		&chatSession.UpdatedTs,
		&chatSession.Title,
		&chatSession.Status,
	); err != nil {
		return nil, err
	}

	return &chatSession, nil
}

func (d *DB) ListChatSessions(ctx context.Context, find *store.FindChatSession) ([]*store.ChatSession, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.CreatorID; v != nil {
		where, args = append(where, "creator_id = ?"), append(args, *v)
	}
	if v := find.Status; v != nil {
		where, args = append(where, "status = ?"), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "uid = ?"), append(args, *v)
	}
	if v := find.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}

	stmt := `
		SELECT 
			id, uid, creator_id, created_ts, updated_ts, title, status
		FROM chat_session
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY updated_ts DESC
	`

	rows, err := d.db.QueryContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chatSessions []*store.ChatSession
	for rows.Next() {
		var chatSession store.ChatSession
		if err := rows.Scan(
			&chatSession.ID,
			&chatSession.UID,
			&chatSession.CreatorID,
			&chatSession.CreatedTs,
			&chatSession.UpdatedTs,
			&chatSession.Title,
			&chatSession.Status,
		); err != nil {
			return nil, err
		}
		chatSessions = append(chatSessions, &chatSession)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return chatSessions, nil
}

func (d *DB) GetChatSession(ctx context.Context, find *store.FindChatSession) (*store.ChatSession, error) {
	sessions, err := d.ListChatSessions(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(sessions) == 0 {
		return nil, nil
	}

	session := sessions[0]
	// Load messages for the session
	messages, err := d.ListChatMessages(ctx, &store.FindChatMessage{SessionID: &session.ID})
	if err != nil {
		return nil, err
	}
	session.Messages = messages

	return session, nil
}

func (d *DB) UpdateChatSession(ctx context.Context, update *store.UpdateChatSession) (*store.ChatSession, error) {
	set, args := []string{}, []any{}

	if v := update.Title; v != nil {
		set, args = append(set, "title = ?"), append(args, *v)
	}

	set, args = append(set, "updated_ts = ?"), append(args, time.Now().Unix())
	args = append(args, update.UID)

	stmt := `
		UPDATE chat_session
		SET ` + strings.Join(set, ", ") + `
		WHERE uid = ?
		RETURNING id, uid, creator_id, created_ts, updated_ts, title, status
	`
	var chatSession store.ChatSession
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&chatSession.ID,
		&chatSession.UID,
		&chatSession.CreatorID,
		&chatSession.CreatedTs,
		&chatSession.UpdatedTs,
		&chatSession.Title,
		&chatSession.Status,
	); err != nil {
		return nil, err
	}

	return &chatSession, nil
}

func (d *DB) DeleteChatSession(ctx context.Context, find *store.FindChatSession) error {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.UID; v != nil {
		where, args = append(where, "uid = ?"), append(args, *v)
	}
	if v := find.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}

	stmt := `DELETE FROM chat_session WHERE ` + strings.Join(where, " AND ")
	_, err := d.db.ExecContext(ctx, stmt, args...)
	return err
}

func (d *DB) CreateChatMessage(ctx context.Context, create *store.ChatMessage) (*store.ChatMessage, error) {
	stmt := `
		INSERT INTO chat_message (
			session_id, created_ts, role, content
		)
		VALUES (?, ?, ?, ?)
		RETURNING id, session_id, created_ts, role, content
	`
	var chatMessage store.ChatMessage
	if err := d.db.QueryRowContext(ctx, stmt,
		create.SessionID,
		create.CreatedTs,
		create.Role,
		create.Content,
	).Scan(
		&chatMessage.ID,
		&chatMessage.SessionID,
		&chatMessage.CreatedTs,
		&chatMessage.Role,
		&chatMessage.Content,
	); err != nil {
		return nil, err
	}

	return &chatMessage, nil
}

func (d *DB) ListChatMessages(ctx context.Context, find *store.FindChatMessage) ([]*store.ChatMessage, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.SessionID; v != nil {
		where, args = append(where, "session_id = ?"), append(args, *v)
	}

	stmt := `
		SELECT 
			id, session_id, created_ts, role, content
		FROM chat_message
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_ts ASC
	`

	rows, err := d.db.QueryContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chatMessages []*store.ChatMessage
	for rows.Next() {
		var chatMessage store.ChatMessage
		if err := rows.Scan(
			&chatMessage.ID,
			&chatMessage.SessionID,
			&chatMessage.CreatedTs,
			&chatMessage.Role,
			&chatMessage.Content,
		); err != nil {
			return nil, err
		}
		chatMessages = append(chatMessages, &chatMessage)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return chatMessages, nil
}
