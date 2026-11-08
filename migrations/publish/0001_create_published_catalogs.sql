-- Bảng lưu trữ phản hồi danh mục đã xuất bản (Pre-rendered Published Catalogs)
-- Mục đích: Đóng gói sẵn toàn bộ JSON response cho các nội dung public (AI Talk scenarios, bài học, từ vựng,...)
-- Worker chỉ cần đọc payload và trả về trực tiếp cho Client, không cần JOIN hay serialize JSON, tốc độ phản hồi cực nhanh.
CREATE TABLE published_catalogs (
  id TEXT PRIMARY KEY,                                      -- UUIDv7
  key TEXT NOT NULL UNIQUE,                                 -- Khóa định danh danh mục (vd: 'ai_talk_scenarios', 'lessons_catalog', 'phonics_list')
  title TEXT,                                               -- Tên gợi nhớ danh mục (vd: 'Danh sách tình huống AI Talk')
  category TEXT NOT NULL DEFAULT 'general',                 -- Nhóm phân loại: 'ai_talk' | 'lesson' | 'vocab' | 'phonics' | 'general'
  payload TEXT NOT NULL,                                    -- Chuỗi JSON response hoàn chỉnh sẵn sàng trả thẳng về Client
  etag TEXT,                                                -- Hash/checksum của payload để hỗ trợ HTTP Caching (304 Not Modified)
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),  -- Số phiên bản tăng dần mỗi khi tái xuất bản
  published_by INTEGER,                                     -- ID của admin thực hiện xuất bản (nếu có)
  created_at INTEGER NOT NULL,                              -- Unix timestamp
  updated_at INTEGER NOT NULL                               -- Unix timestamp lần xuất bản gần nhất
);

CREATE UNIQUE INDEX idx_published_catalogs_key ON published_catalogs(key);
CREATE INDEX idx_published_catalogs_category ON published_catalogs(category, updated_at DESC);
