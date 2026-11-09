-- 3. Bảng phiên rèn luyện của người học (Sessions)
-- Lưu lại quá trình tương tác, hội thoại và kết quả hoàn thành nhiệm vụ
CREATE TABLE ai_talk_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,                        -- ID phiên dạng số tự tăng (nhẹ & nhanh)
  user_id INTEGER NOT NULL,                                    -- ID người dùng từ JWT
  profile_id INTEGER,                                          -- ID hồ sơ người học (nếu có)
  scenario_id TEXT NOT NULL,                                   -- Mã kịch bản (do client quản lý)
  scenario_snapshot TEXT,                                       -- JSON snapshot cấu hình kịch bản do client gửi khi tạo session
  status TEXT NOT NULL DEFAULT 'in_progress',                  -- 'in_progress' | 'completed' | 'failed' | 'abandoned'
  turns_count INTEGER NOT NULL DEFAULT 0 CHECK (turns_count >= 0), -- Số lượt người học đã nói
  max_turns INTEGER NOT NULL DEFAULT 10 CHECK (max_turns > 0), -- Giới hạn số lượt của phiên
  completed_missions TEXT NOT NULL DEFAULT '[]',               -- JSON array mã mục tiêu đã đạt: ["flavor", "size"]
  score INTEGER,                                               -- Điểm số đánh giá năng lực thực tế (vd: 0 - 100)
  focus_score INTEGER DEFAULT 100,                             -- Điểm tập trung duy trì phiên (chống lạc đề: 100 -> 0)
  messages TEXT NOT NULL DEFAULT '[]',                         -- JSON array toàn bộ tin nhắn qua lại giữa bé và AI
  feedback TEXT,                                               -- Đánh giá, khen ngợi và gợi ý cải thiện ngôn ngữ sau khi kết thúc
  created_at INTEGER NOT NULL,                                 -- Unix timestamp bắt đầu phiên
  updated_at INTEGER NOT NULL                                  -- Unix timestamp tương tác gần nhất
);

-- Index tối ưu cho truy vấn lọc lịch sử theo profile hoặc profile + tình huống
CREATE INDEX idx_ai_talk_sessions_profile_scenario ON ai_talk_sessions(profile_id, scenario_id, created_at DESC);
