-- 2. Bảng tình huống rèn luyện (Scenarios)
-- Thuộc về một danh mục và giao danh sách nhiệm vụ cụ thể cho người học thực hiện
CREATE TABLE ai_talk_scenarios (
  id TEXT PRIMARY KEY,                                         -- Mã tình huống (vd: 'order-pizza')
  category TEXT REFERENCES ai_talk_categories(code) ON DELETE SET NULL, -- Danh mục chủ đề
  title TEXT NOT NULL,                                         -- Tên bài luyện (vd: 'Ordering Pizza')
  situation TEXT NOT NULL,                                     -- Bối cảnh (vd: 'Bạn đang ở một tiệm bánh pizza')
  missions TEXT NOT NULL DEFAULT '[]',                         -- JSON array các mục tiêu cần đạt: [{"code": "flavor", "text": "Chọn vị bánh"}]
  ai_role TEXT NOT NULL,                                       -- Vai trò AI đóng (vd: 'Nhân viên bán pizza thân thiện')
  user_role TEXT NOT NULL,                                     -- Vai trò người học (vd: 'Khách mua bánh')
  ai_prompt TEXT NOT NULL,                                     -- Hướng dẫn AI: tính cách, phản hồi ngắn, kiểm tra đạt nhiệm vụ
  first_message TEXT NOT NULL,                                 -- Lời mở đầu của AI
  max_turns INTEGER NOT NULL DEFAULT 10 CHECK (max_turns > 0)  -- Số lượt tối đa để hoàn thành nhiệm vụ
);

CREATE INDEX idx_ai_talk_scenarios_category ON ai_talk_scenarios(category);
