-- 2. Bảng quản lý danh mục kịch bản tinh gọn (Scenarios)
-- Chỉ lưu thông tin định danh, danh mục và hạn mức (credit, max turn), không lưu cấu hình phức tạp
CREATE TABLE ai_talk_scenarios (
  code TEXT PRIMARY KEY,                                       -- Mã kịch bản (vd: 'pizza_order', 'cafe_order')
  name TEXT NOT NULL,                                          -- Tên hiển thị của kịch bản
  category TEXT NOT NULL REFERENCES ai_talk_categories(code) ON DELETE RESTRICT, -- Danh mục phân cấp
  credit_cost INTEGER NOT NULL DEFAULT 1 CHECK (credit_cost >= 0), -- Điểm credit cần để tạo phiên
  max_turns INTEGER NOT NULL DEFAULT 10 CHECK (max_turns > 0), -- Số lần gọi LLM tối đa cho phép trong phiên
  created_at INTEGER NOT NULL,                                 -- Unix timestamp tạo
  updated_at INTEGER NOT NULL                                  -- Unix timestamp cập nhật
);

CREATE INDEX idx_ai_talk_scenarios_category ON ai_talk_scenarios(category);
