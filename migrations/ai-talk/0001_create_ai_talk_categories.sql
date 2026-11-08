-- 1. Bảng danh mục chủ đề (Categories)
-- Hỗ trợ phân cấp cây cha - con (Parent - Child) không giới hạn cấp độ
CREATE TABLE ai_talk_categories (
  id TEXT PRIMARY KEY,                                      -- Mã danh mục (vd: 'daily-life', 'food-drinks')
  parent_id TEXT REFERENCES ai_talk_categories(id) ON DELETE SET NULL, -- Danh mục cha (NULL nếu là danh mục gốc)
  slug TEXT NOT NULL UNIQUE,                                -- Đường dẫn định danh (vd: 'daily-life', 'food-drinks')
  name TEXT NOT NULL,                                       -- Tên danh mục (vd: 'Food & Drinks')
  description TEXT,                                         -- Mô tả chủ đề
  icon_url TEXT,                                            -- Icon minh họa
  cover_url TEXT,                                           -- Ảnh bìa chủ đề
  order_index INTEGER NOT NULL DEFAULT 0,                   -- Thứ tự sắp xếp trong cùng cấp cha
  created_at INTEGER NOT NULL,                              -- Unix timestamp
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_ai_talk_categories_parent ON ai_talk_categories(parent_id, order_index ASC);
CREATE INDEX idx_ai_talk_categories_slug ON ai_talk_categories(slug);
