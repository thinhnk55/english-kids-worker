-- 2. Bảng vai trò trong tình huống (Scenario Roles)
-- Cho phép người học tự chọn vai trò (vd: Khách hàng, Thu ngân, Đầu bếp)
-- Ứng với mỗi vai trò của người học, AI sẽ đóng vai trò đối ứng tương ứng
CREATE TABLE ai_talk_scenario_roles (
  id TEXT PRIMARY KEY,                                      -- UUIDv7
  scenario_id TEXT NOT NULL REFERENCES ai_talk_scenarios(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL,                                  -- Mã vai trò (vd: 'customer', 'staff', 'chef')
  role_name TEXT NOT NULL,                                  -- Tên vai trò hiển thị cho bé (vd: 'Khách mua bánh', 'Nhân viên thu ngân')
  description TEXT,                                         -- Mô tả vai trò và nhiệm vụ tổng quát
  avatar_url TEXT,                                          -- Ảnh đại diện cho vai trò này
  ai_role_name TEXT NOT NULL,                               -- Tên vai trò mà AI sẽ đóng (vd: 'Nhân viên bán bánh', 'Khách mua hàng')
  initial_prompt TEXT NOT NULL,                             -- System prompt định hình bối cảnh & nhân vật cho AI
  first_speaker TEXT NOT NULL DEFAULT 'ai',                 -- 'ai' | 'user' (bên nào mở lời trước)
  first_message TEXT,                                       -- Câu mở đầu (nếu AI nói trước)
  max_turns INTEGER NOT NULL DEFAULT 20 CHECK (max_turns > 0), -- Giới hạn số lượt trao đổi của vai trò này
  initial_focus_score INTEGER NOT NULL DEFAULT 100 CHECK (initial_focus_score > 0), -- Điểm tập trung ban đầu
  config TEXT NOT NULL DEFAULT '{}',                        -- Cấu hình linh hoạt: TTS (voice_id, speed), gợi ý từ vựng, mẫu câu mồi
  order_index INTEGER NOT NULL DEFAULT 0,                   -- Thứ tự hiển thị lựa chọn vai trò
  created_at INTEGER NOT NULL,                              -- Unix timestamp
  updated_at INTEGER NOT NULL,
  UNIQUE(scenario_id, role_code)
);

CREATE INDEX idx_ai_talk_roles_scenario ON ai_talk_scenario_roles(scenario_id, order_index ASC);
