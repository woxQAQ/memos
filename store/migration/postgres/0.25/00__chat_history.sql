-- AI Chat History Tables

-- chat_session table to store chat sessions
CREATE TABLE chat_session (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(255) NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  title TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')) DEFAULT 'ACTIVE'
);

CREATE INDEX idx_chat_session_creator_id ON chat_session (creator_id);
CREATE INDEX idx_chat_session_created_ts ON chat_session (created_ts);

-- chat_message table to store individual messages in sessions
CREATE TABLE chat_message (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_session (id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_message_session_id ON chat_message (session_id);
CREATE INDEX idx_chat_message_created_ts ON chat_message (created_ts); 