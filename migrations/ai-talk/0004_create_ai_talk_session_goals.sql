-- 4. Bảng tiến độ nhiệm vụ theo phiên (Session Goals): theo dõi nhiệm vụ nào đã đạt
CREATE TABLE ai_talk_session_goals (
  session_id TEXT NOT NULL REFERENCES ai_talk_sessions(id) ON DELETE CASCADE,
  goal_id INTEGER NOT NULL REFERENCES ai_talk_scenario_goals(id) ON DELETE CASCADE,
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
  completed_at INTEGER,
  completed_turn_index INTEGER,
  PRIMARY KEY (session_id, goal_id)
) WITHOUT ROWID;
