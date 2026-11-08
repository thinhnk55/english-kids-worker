-- 5. Bảng tin nhắn / lượt thoại (Session Messages): lưu lịch sử, feedback 3 tiêu chí và điểm trừ
CREATE TABLE ai_talk_session_messages (
  id TEXT PRIMARY KEY,                                      -- UUIDv7
  session_id TEXT NOT NULL REFERENCES ai_talk_sessions(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL CHECK (turn_index >= 0),      -- Lượt trao đổi (0, 1, 2...)
  role TEXT NOT NULL,                                       -- 'user' | 'assistant'
  content TEXT NOT NULL,                                    -- Nội dung câu nói
  audio_url TEXT,                                           -- URL audio giọng nói (tùy chọn)
  feedback_accuracy TEXT,                                   -- Feedback: Chính tả, ngữ pháp, từ vựng
  feedback_relevance TEXT,                                  -- Feedback: Mức độ liên quan đến tình huống
  feedback_naturalness TEXT,                                -- Feedback: Cách diễn đạt tự nhiên hơn
  relevance_status TEXT,                                    -- 'on_topic' | 'minor_off_topic' | 'off_topic' | 'deliberate_off_topic'
  score_change INTEGER NOT NULL DEFAULT 0,                  -- Điểm thay đổi ở lượt này: 0, -10, -25, -35
  focus_score_after INTEGER,                                -- Điểm tập trung sau khi áp dụng lượt này
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_ai_talk_messages_session ON ai_talk_session_messages(session_id, turn_index ASC);
