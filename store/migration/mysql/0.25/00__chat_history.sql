-- AI Chat History Tables

-- chat_session table to store chat sessions
CREATE TABLE chat_session (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uid VARCHAR(255) NOT NULL UNIQUE,
  creator_id INT NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  updated_ts BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  title TEXT NOT NULL DEFAULT (''),
  status ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE'
);

CREATE INDEX idx_chat_session_creator_id ON chat_session (creator_id);
CREATE INDEX idx_chat_session_created_ts ON chat_session (created_ts);

-- chat_message table to store individual messages in sessions
CREATE TABLE chat_message (
  id INT PRIMARY KEY AUTO_INCREMENT,
  session_id INT NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  role ENUM('user', 'assistant', 'system') NOT NULL,
  content TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_session (id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_message_session_id ON chat_message (session_id);
CREATE INDEX idx_chat_message_created_ts ON chat_message (created_ts); 