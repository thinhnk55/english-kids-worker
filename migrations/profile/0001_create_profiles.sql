-- Bảng hồ sơ người học (Profiles)
-- Một tài khoản phụ huynh (user_id) có thể tạo nhiều hồ sơ cho các bé
CREATE TABLE profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,                                 -- ID tài khoản người dùng từ JWT
  name TEXT NOT NULL,                                       -- Tên của bé (vd: 'Bé Bi', 'Tony')
  avatar TEXT,                                              -- Mã avatar hoặc link ảnh đại diện
  birth_year INTEGER,                                       -- Năm sinh của bé để gợi ý nội dung phù hợp
  gender TEXT,                                              -- Giới tính: 'male' | 'female' | 'other'
  created_at INTEGER NOT NULL,                              -- Unix timestamp
  updated_at INTEGER NOT NULL                               -- Unix timestamp
);

CREATE INDEX idx_profiles_user ON profiles(user_id);
