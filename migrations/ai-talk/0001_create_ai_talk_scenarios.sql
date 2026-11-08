-- 1. Bảng tình huống rèn luyện (Scenarios)
-- Đặt người học vào một tình huống và giao 1 nhiệm vụ cụ thể để rèn luyện ngôn ngữ
CREATE TABLE ai_talk_scenarios (
  id TEXT PRIMARY KEY,                                         -- Mã tình huống (vd: 'order-pizza', 'ask-the-way')
  title TEXT NOT NULL,                                         -- Tên bài luyện (vd: 'Ordering Pizza')
  situation TEXT NOT NULL,                                     -- Bối cảnh (vd: 'Bạn đang ở một tiệm bánh pizza')
  mission TEXT NOT NULL,                                       -- Nhiệm vụ giao cho người học (vd: 'Hãy gọi một chiếc pizza phô mai cỡ vừa mang về')
  ai_role TEXT NOT NULL,                                       -- Vai trò AI đóng (vd: 'Nhân viên bán pizza thân thiện')
  user_role TEXT NOT NULL,                                     -- Vai trò người học (vd: 'Khách mua bánh')
  ai_prompt TEXT NOT NULL,                                     -- Hướng dẫn AI: tính cách, cách phản hồi ngắn gọn, nhận biết người học đã đạt nhiệm vụ
  first_message TEXT NOT NULL,                                 -- Lời chào mở đầu của AI để bắt đầu tình huống
  max_turns INTEGER NOT NULL DEFAULT 10 CHECK (max_turns > 0), -- Số lượt tối đa để người học hoàn thành nhiệm vụ
  created_at INTEGER NOT NULL,                                 -- Unix timestamp
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_ai_talk_scenarios_created ON ai_talk_scenarios(created_at DESC);
