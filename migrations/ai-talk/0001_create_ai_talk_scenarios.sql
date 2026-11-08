-- 1. Bảng tình huống hội thoại AI Talk (Scenarios)
-- Backend dùng bảng này để kiểm soát logic, prompt, vai trò, số lượt tối đa và danh sách nhiệm vụ (goals)
CREATE TABLE ai_talk_scenarios (
  id TEXT PRIMARY KEY,                                      -- UUIDv7
  slug TEXT NOT NULL UNIQUE,                                -- Đường dẫn định danh (vd: 'at-pizza-store')
  title TEXT NOT NULL,                                      -- Tiêu đề tình huống (vd: 'Ordering Pizza')
  description TEXT,                                         -- Mô tả ngắn cho học sinh
  level TEXT,                                               -- Mức độ: 'beginner' | 'intermediate' | 'advanced' (không default value)
  icon_url TEXT,                                            -- Icon minh họa
  cover_url TEXT,                                           -- Ảnh bìa tình huống
  ai_role TEXT NOT NULL,                                    -- Vai trò AI (vd: 'Nhân viên bán pizza thân thiện')
  user_role TEXT NOT NULL,                                  -- Vai trò học sinh (vd: 'Khách hàng nhí gọi pizza')
  initial_prompt TEXT NOT NULL,                             -- System prompt hướng dẫn ngữ cảnh cho AI
  first_message TEXT NOT NULL,                              -- Câu chào mở đầu của AI khi bắt đầu hội thoại
  max_turns INTEGER NOT NULL DEFAULT 20 CHECK (max_turns > 0), -- Giới hạn số lượt tin nhắn của phiên
  initial_focus_score INTEGER NOT NULL DEFAULT 100 CHECK (initial_focus_score > 0), -- Điểm tập trung ban đầu (mặc định 100)
  goals TEXT NOT NULL DEFAULT '[]',                         -- JSON array danh sách nhiệm vụ: [{"code": "order_size", "title": "Chọn kích cỡ pizza", "prompt_instruction": "..."}]
  is_published INTEGER NOT NULL DEFAULT 0,                  -- 0: nháp (draft), 1: đã xuất bản (published)
  published_at INTEGER,                                     -- Thời điểm xuất bản
  created_at INTEGER NOT NULL,                              -- Unix timestamp
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_ai_talk_scenarios_slug ON ai_talk_scenarios(slug);
CREATE INDEX idx_ai_talk_scenarios_level ON ai_talk_scenarios(level);
CREATE INDEX idx_ai_talk_scenarios_published ON ai_talk_scenarios(is_published);
