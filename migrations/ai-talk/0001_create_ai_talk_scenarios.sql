-- 1. Bảng tình huống (Scenarios): bối cảnh hội thoại, vai trò và prompt mở đầu
CREATE TABLE ai_talk_scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,                                -- e.g. 'ordering-pizza'
  title TEXT NOT NULL,                                      -- e.g. 'Ordering Pizza 🍕'
  description TEXT NOT NULL,                                -- Mô tả bối cảnh tình huống
  ai_role TEXT NOT NULL,                                    -- Vai trò của AI (ví dụ: 'waiter' / 'nhân viên phục vụ')
  user_role TEXT NOT NULL,                                  -- Vai trò của người học (ví dụ: 'customer' / 'khách hàng')
  initial_prompt TEXT NOT NULL,                             -- Hướng dẫn system persona & phạm vi giao tiếp cho AI
  first_message TEXT NOT NULL,                              -- Câu chào đầu tiên AI nói khi bắt đầu phiên
  icon_url TEXT,                                            -- Icon minh họa
  cover_url TEXT,                                           -- Ảnh bìa bối cảnh
  level TEXT,                                               -- Cấp độ (ví dụ: 'A1', 'A2'...), không có default value
  max_turns INTEGER NOT NULL DEFAULT 20 CHECK (max_turns > 0), -- Giới hạn tối đa số lượt nói trong 1 phiên
  initial_focus_score INTEGER NOT NULL DEFAULT 100 CHECK (initial_focus_score > 0), -- Điểm tập trung ban đầu
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_ai_talk_scenarios_slug ON ai_talk_scenarios(slug);
