-- 2. Bảng phiên trò chuyện AI Talk (Sessions)
-- Gộp toàn bộ phiên hội thoại, trạng thái nhiệm vụ và tin nhắn/feedback vào 1 bảng
CREATE TABLE ai_talk_sessions (
  id TEXT PRIMARY KEY,                                      -- UUIDv7
  user_id INTEGER NOT NULL,                                 -- ID người dùng từ JWT
  profile_id INTEGER,                                       -- ID hồ sơ người học (nếu có)
  scenario_id TEXT NOT NULL REFERENCES ai_talk_scenarios(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'in_progress',               -- 'in_progress' | 'completed' | 'failed' | 'max_turns_reached' | 'abandoned'
  focus_score INTEGER NOT NULL DEFAULT 100 CHECK (focus_score >= 0), -- Điểm tập trung (0-100), về 0 coi như thất bại
  turns_count INTEGER NOT NULL DEFAULT 0 CHECK (turns_count >= 0), -- Số lượt người học đã gửi
  max_turns INTEGER NOT NULL DEFAULT 20 CHECK (max_turns > 0),     -- Giới hạn số tin nhắn của phiên, quá số này kết thúc
  completed_goals TEXT NOT NULL DEFAULT '[]',               -- JSON array mã mục tiêu đã đạt: ["order_size", ...]
  messages TEXT NOT NULL DEFAULT '[]',                      -- JSON array toàn bộ tin nhắn & feedback 3 tiêu chí
  created_at INTEGER NOT NULL,                              -- Unix timestamp
  updated_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE INDEX idx_ai_talk_sessions_user ON ai_talk_sessions(user_id, created_at DESC);
CREATE INDEX idx_ai_talk_sessions_scenario ON ai_talk_sessions(scenario_id, created_at DESC);
CREATE INDEX idx_ai_talk_sessions_status ON ai_talk_sessions(status, created_at DESC);
