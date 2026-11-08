-- 3. Bảng mục tiêu/nhiệm vụ theo vai trò (Scenario Role Goals)
-- Mỗi vai trò người học chọn sẽ có bộ nhiệm vụ cần đạt tương ứng
CREATE TABLE ai_talk_scenario_goals (
  id TEXT PRIMARY KEY,                                      -- UUIDv7
  role_id TEXT NOT NULL REFERENCES ai_talk_scenario_roles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                                       -- Mã nhiệm vụ (vd: 'greet_customer', 'ask_size', 'pay_money')
  title TEXT NOT NULL,                                      -- Tên nhiệm vụ hiển thị (vd: 'Chào khách và hỏi kích cỡ bánh')
  prompt_instruction TEXT NOT NULL,                         -- Tiêu chuẩn LLM kiểm tra xem học sinh đã hoàn thành mục tiêu này chưa
  order_index INTEGER NOT NULL DEFAULT 0,                   -- Thứ tự xuất hiện nhiệm vụ
  created_at INTEGER NOT NULL,                              -- Unix timestamp
  updated_at INTEGER NOT NULL,
  UNIQUE(role_id, code)
);

CREATE INDEX idx_ai_talk_goals_role ON ai_talk_scenario_goals(role_id, order_index ASC);
