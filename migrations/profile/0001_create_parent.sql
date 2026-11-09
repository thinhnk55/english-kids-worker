-- Bảng phụ huynh (Parent) gắn với tài khoản người dùng
-- Giới hạn số lượng hồ sơ (profile) tối đa được phép tạo
CREATE TABLE parent (
  user_id INTEGER PRIMARY KEY,                                      -- ID tài khoản người dùng từ JWT (1-1)
  max_profiles INTEGER NOT NULL DEFAULT 2 CHECK (max_profiles > 0), -- Giới hạn số lượng profile tối đa được tạo (mặc định 2)
  created_at INTEGER NOT NULL,                                      -- Unix timestamp tạo bản ghi
  updated_at INTEGER NOT NULL                                       -- Unix timestamp cập nhật gần nhất
);
