-- 3. Bảng phiên rèn luyện của người học (Sessions)
-- Lưu lại quá trình tương tác, hội thoại và kết quả hoàn thành nhiệm vụ
CREATE TABLE ai_talk_sessions (
  id TEXT PRIMARY KEY,                                         -- UUIDv7 định danh phiên
  user_id INTEGER NOT NULL,                                    -- ID người dùng từ JWT
  profile_id INTEGER,                                          -- ID hồ sơ người học (nếu có)
  scenario_id TEXT NOT NULL REFERENCES ai_talk_scenarios(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'in_progress',                  -- 'in_progress' | 'completed' | 'failed' | 'abandoned'
  turns_count INTEGER NOT NULL DEFAULT 0 CHECK (turns_count >= 0), -- Số lượt người học đã nói
  max_turns INTEGER NOT NULL DEFAULT 10 CHECK (max_turns > 0), -- Giới hạn số lượt của phiên
  score INTEGER,                                               -- Điểm số đánh giá phiên rèn luyện (vd: 0 - 100)
  messages TEXT NOT NULL DEFAULT '[]',                         -- JSON array toàn bộ tin nhắn qua lại giữa bé và AI
  feedback TEXT,                                               -- Đánh giá, khen ngợi và gợi ý cải thiện ngôn ngữ sau khi kết thúc
  created_at INTEGER NOT NULL,                                 -- Unix timestamp bắt đầu phiên
  updated_at INTEGER NOT NULL                                  -- Unix timestamp tương tác gần nhất
);

CREATE INDEX idx_ai_talk_sessions_user ON ai_talk_sessions(user_id, created_at DESC);
CREATE INDEX idx_ai_talk_sessions_scenario ON ai_talk_sessions(scenario_id, created_at DESC);
CREATE INDEX idx_ai_talk_sessions_status ON ai_talk_sessions(status, created_at DESC);
