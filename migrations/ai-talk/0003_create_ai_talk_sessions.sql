-- 3. Bảng phiên rèn luyện của người học (Sessions)
-- Tối gọn các chi tiết vào meta (JSON). Duy trì các chỉ số cốt lõi: turn, score, energy
CREATE TABLE ai_talk_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,                        -- ID phiên dạng số tự tăng (nhẹ & nhanh)
  user_id INTEGER NOT NULL,                                    -- ID người dùng từ JWT
  profile_id INTEGER,                                          -- ID hồ sơ người học (nếu có)
  scenario_id TEXT NOT NULL,                                   -- Mã kịch bản
  status TEXT NOT NULL DEFAULT 'in_progress',                  -- 'in_progress' | 'completed' | 'failed' | 'abandoned'
  turn INTEGER NOT NULL DEFAULT 0,                             -- Số lượt người học đã gửi nội dung lên
  max_turn INTEGER NOT NULL,                                   -- Giới hạn số lượt của phiên
  energy INTEGER,                                              -- Số lần vi phạm cho phép còn lại (FE quyết định, không default)
  score INTEGER,                                               -- Điểm số đánh giá năng lực (FE quyết định)
  meta TEXT,                                                   -- JSON lưu trữ toàn bộ dữ liệu kèm theo (messages, missions, feedback, v.v.)
  created_at INTEGER NOT NULL,                                 -- Unix timestamp bắt đầu phiên
  updated_at INTEGER NOT NULL                                  -- Unix timestamp tương tác gần nhất
);

-- Index tối ưu cho truy vấn lọc lịch sử theo profile hoặc profile + tình huống
CREATE INDEX idx_ai_talk_sessions_profile_scenario ON ai_talk_sessions(profile_id, scenario_id, created_at DESC);
