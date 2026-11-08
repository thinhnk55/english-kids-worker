-- 1. Bảng tình huống hội thoại (Scenarios)
-- Quản lý bối cảnh chung, chủ đề, mức độ và thông tin hiển thị
CREATE TABLE ai_talk_scenarios (
  id TEXT PRIMARY KEY,                                      -- UUIDv7
  slug TEXT NOT NULL UNIQUE,                                -- Đường dẫn định danh (vd: 'at-pizza-store')
  title TEXT NOT NULL,                                      -- Tiêu đề tình huống (vd: 'At the Pizza Store')
  description TEXT,                                         -- Mô tả bối cảnh tình huống cho học sinh
  level TEXT,                                               -- 'beginner' | 'intermediate' | 'advanced' (không default)
  category TEXT NOT NULL DEFAULT 'daily_life',              -- Nhóm chủ đề: 'food_drink', 'school', 'animals', 'daily_life'
  icon_url TEXT,                                            -- Icon minh họa
  cover_url TEXT,                                           -- Ảnh bìa bối cảnh
  order_index INTEGER NOT NULL DEFAULT 0,                   -- Thứ tự hiển thị ưu tiên
  is_published INTEGER NOT NULL DEFAULT 0,                  -- 0: nháp, 1: đã xuất bản
  published_at INTEGER,                                     -- Thời điểm xuất bản
  created_at INTEGER NOT NULL,                              -- Unix timestamp
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_ai_talk_scenarios_slug ON ai_talk_scenarios(slug);
CREATE INDEX idx_ai_talk_scenarios_category ON ai_talk_scenarios(category, order_index ASC);
CREATE INDEX idx_ai_talk_scenarios_published ON ai_talk_scenarios(is_published);
