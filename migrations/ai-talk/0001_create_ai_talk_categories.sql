-- 1. Bảng danh mục chủ đề (Categories)
-- Phân cấp cây cha - con tối giản: code, parent_code, name, position
CREATE TABLE ai_talk_categories (
  code TEXT PRIMARY KEY,                                       -- Mã danh mục (vd: 'daily_life', 'restaurant')
  parent_code TEXT REFERENCES ai_talk_categories(code) ON DELETE SET NULL, -- Danh mục cha (NULL nếu là danh mục gốc)
  name TEXT NOT NULL,                                          -- Tên hiển thị (vd: 'Food & Drinks')
  position INTEGER NOT NULL DEFAULT 0                          -- Thứ tự sắp xếp
);

CREATE INDEX idx_ai_talk_categories_parent ON ai_talk_categories(parent_code, position ASC);
