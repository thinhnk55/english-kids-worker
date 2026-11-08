-- Bảng lưu trữ nội dung đã xuất bản (Published Catalogs)
-- Lưu payload linh hoạt theo key để phục vụ truy cập nhanh
CREATE TABLE published_catalogs (
  key TEXT PRIMARY KEY,                                     -- Khóa định danh
  payload TEXT NOT NULL                                     -- Dữ liệu JSON linh hoạt theo nhu cầu
);
