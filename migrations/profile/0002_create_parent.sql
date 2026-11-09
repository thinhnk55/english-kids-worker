-- Bảng phụ huynh (Parent) gắn với tài khoản người dùng
-- Quản lý pass code phụ huynh và giới hạn số lượng hồ sơ (profile) tối đa được phép tạo
CREATE TABLE parent (
  user_id INTEGER PRIMARY KEY,                                      -- ID tài khoản người dùng từ JWT (1-1)
  pass_code TEXT,                                                   -- Mã pass code bảo vệ khu vực phụ huynh
  max_profiles INTEGER NOT NULL DEFAULT 4 CHECK (max_profiles > 0), -- Giới hạn số lượng profile tối đa được tạo
  created_at INTEGER NOT NULL,                                      -- Unix timestamp tạo bản ghi
  updated_at INTEGER NOT NULL                                       -- Unix timestamp cập nhật gần nhất
);
