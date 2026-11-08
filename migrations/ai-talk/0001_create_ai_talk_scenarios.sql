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
  difficulty TEXT NOT NULL DEFAULT 'beginner',              -- 'beginner' | 'intermediate' | 'advanced'
  initial_focus_score INTEGER NOT NULL DEFAULT 100 CHECK (initial_focus_score > 0), -- Mặc định 100 điểm
  status TEXT NOT NULL DEFAULT 'published',                 -- 'draft' | 'published' | 'archived'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_ai_talk_scenarios_slug ON ai_talk_scenarios(slug);
CREATE INDEX idx_ai_talk_scenarios_status ON ai_talk_scenarios(status, created_at DESC);
