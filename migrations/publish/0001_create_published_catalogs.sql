-- Bảng lưu trữ phản hồi danh mục đã xuất bản (Published Catalogs)
-- Đóng gói sẵn toàn bộ taxonomy + danh sách dữ liệu thành response hoàn chỉnh
-- Client truy cập trực tiếp bằng key, Worker trả ngay payload không qua xử lý trung gian
CREATE TABLE published_catalogs (
  key TEXT PRIMARY KEY,                                     -- Khóa định danh danh mục (vd: 'ai_talk_catalog', 'phonics_catalog')
  payload TEXT NOT NULL,                                    -- Toàn bộ JSON response đóng gói sẵn (bao gồm taxonomy, filter và danh sách dữ liệu)
  updated_at INTEGER NOT NULL                               -- Unix timestamp thời điểm xuất bản gần nhất
);
