-- Bảng lưu trữ số dư credit của người dùng
-- Kiểm soát số lượt tạo phiên hội thoại, bảo vệ chi phí và ngăn chặn lạm dụng LLM
CREATE TABLE user_credits (
  user_id INTEGER PRIMARY KEY,                                      -- ID người dùng từ JWT
  credits INTEGER NOT NULL DEFAULT 50 CHECK (credits >= 0),         -- Số điểm credit khả dụng
  total_spent INTEGER NOT NULL DEFAULT 0 CHECK (total_spent >= 0),  -- Tổng số credit đã sử dụng
  created_at INTEGER NOT NULL,                                      -- Unix timestamp tạo bản ghi
  updated_at INTEGER NOT NULL                                       -- Unix timestamp cập nhật gần nhất
);

-- Bảng ghi nhận lịch sử biến động credit
CREATE TABLE credit_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES user_credits(user_id),
  amount INTEGER NOT NULL,                                          -- Số credit thay đổi (-1 khi tạo phiên, +N khi nạp)
  balance_after INTEGER NOT NULL,                                   -- Số dư sau giao dịch
  reason TEXT NOT NULL,                                             -- 'start_session' | 'grant' | 'refund'
  ref_id TEXT,                                                      -- Mã tham chiếu (vd: session_id)
  created_at INTEGER NOT NULL                                       -- Unix timestamp
);

CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);
