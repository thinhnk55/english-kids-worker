-- 3. Bảng phiên trò chuyện (Sessions): quản lý trạng thái, điểm tập trung và tiến độ
CREATE TABLE ai_talk_sessions (
  id TEXT PRIMARY KEY,                                      -- UUIDv7
  user_id INTEGER NOT NULL,                                 -- ID người dùng từ JWT
  profile_id INTEGER,                                       -- ID hồ sơ người học (nếu có)
  scenario_id INTEGER NOT NULL REFERENCES ai_talk_scenarios(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'in_progress',               -- 'in_progress' | 'completed' | 'failed' | 'abandoned'
  focus_score INTEGER NOT NULL DEFAULT 100 CHECK (focus_score >= 0), -- Điểm tập trung, về 0 là thất bại
  completed_goals_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_goals_count >= 0),
  total_goals_count INTEGER NOT NULL DEFAULT 0 CHECK (total_goals_count >= 0),
  total_turns INTEGER NOT NULL DEFAULT 0 CHECK (total_turns >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE INDEX idx_ai_talk_sessions_user ON ai_talk_sessions(user_id, created_at DESC);
CREATE INDEX idx_ai_talk_sessions_scenario ON ai_talk_sessions(scenario_id, created_at DESC);
CREATE INDEX idx_ai_talk_sessions_status ON ai_talk_sessions(status, created_at DESC);
