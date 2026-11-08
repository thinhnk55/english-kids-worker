-- 2. Bảng nhiệm vụ (Scenario Goals): danh sách mục tiêu cần hoàn thành trong tình huống
CREATE TABLE ai_talk_scenario_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL REFERENCES ai_talk_scenarios(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                                       -- Mã nhiệm vụ nội bộ, e.g. 'order_pizza'
  title TEXT NOT NULL,                                      -- Tiêu đề hiển thị cho người học: 'Gọi một chiếc pizza'
  prompt_instruction TEXT NOT NULL,                         -- Tiêu chuẩn để LLM nhận diện mục tiêu này đã hoàn thành
  order_index INTEGER NOT NULL DEFAULT 0,                   -- Thứ tự hiển thị
  created_at INTEGER NOT NULL,
  UNIQUE(scenario_id, code)
);

CREATE INDEX idx_ai_talk_scenario_goals_scenario ON ai_talk_scenario_goals(scenario_id, order_index);
