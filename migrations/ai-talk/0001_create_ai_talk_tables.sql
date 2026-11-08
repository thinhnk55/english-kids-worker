-- ==============================================================================
-- AI Talk: Tình huống giao tiếp, nhiệm vụ và phiên trò chuyện
-- Lưu ý quy tắc D1: Không dùng CHECK (IN (...)) cho các cột enum để dễ mở rộng.
-- Thời gian lưu dạng unix timestamp milliseconds (UTC).
-- ==============================================================================

-- 1. Bảng tình huống (Scenarios): bối cảnh hội thoại, vai trò và prompt mở đầu
CREATE TABLE ai_talk_scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,                                -- e.g. 'ordering-pizza'
  title TEXT NOT NULL,                                      -- e.g. 'Ordering Pizza 🍕'
  description TEXT NOT NULL,                                -- Mô tả bối cảnh tình huống
  ai_role TEXT NOT NULL,                                    -- Vai trò của AI (ví dụ: 'waiter' / 'nhân viên phục vụ')
  user_role TEXT NOT NULL,                                  -- Vai trò của người học (ví dụ: 'customer' / 'khách hàng')
  initial_prompt TEXT NOT NULL,                             -- Hướng dẫn system persona & phạm vi giao tiếp cho AI
  first_message TEXT NOT NULL,                              -- Câu chào đầu tiên AI nói khi bắt đầu phiên
  icon_url TEXT,                                            -- Icon minh họa
  cover_url TEXT,                                           -- Ảnh bìa bối cảnh
  difficulty TEXT NOT NULL DEFAULT 'beginner',              -- 'beginner' | 'intermediate' | 'advanced'
  initial_focus_score INTEGER NOT NULL DEFAULT 100 CHECK (initial_focus_score > 0), -- Mặc định 100 điểm
  status TEXT NOT NULL DEFAULT 'published',                 -- 'draft' | 'published' | 'archived'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_ai_talk_scenarios_slug ON ai_talk_scenarios(slug);
CREATE INDEX idx_ai_talk_scenarios_status ON ai_talk_scenarios(status, created_at DESC);

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

-- 4. Bảng tiến độ nhiệm vụ theo phiên (Session Goals): theo dõi nhiệm vụ nào đã đạt
CREATE TABLE ai_talk_session_goals (
  session_id TEXT NOT NULL REFERENCES ai_talk_sessions(id) ON DELETE CASCADE,
  goal_id INTEGER NOT NULL REFERENCES ai_talk_scenario_goals(id) ON DELETE CASCADE,
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
  completed_at INTEGER,
  completed_turn_index INTEGER,
  PRIMARY KEY (session_id, goal_id)
) WITHOUT ROWID;

-- 5. Bảng tin nhắn / lượt thoại (Session Messages): lưu lịch sử, feedback 3 tiêu chí và điểm trừ
CREATE TABLE ai_talk_session_messages (
  id TEXT PRIMARY KEY,                                      -- UUIDv7
  session_id TEXT NOT NULL REFERENCES ai_talk_sessions(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL CHECK (turn_index >= 0),      -- Lượt trao đổi (0, 1, 2...)
  role TEXT NOT NULL,                                       -- 'user' | 'assistant'
  content TEXT NOT NULL,                                    -- Nội dung câu nói
  audio_url TEXT,                                           -- URL audio giọng nói (tùy chọn)
  feedback_accuracy TEXT,                                   -- Feedback: Chính tả, ngữ pháp, từ vựng
  feedback_relevance TEXT,                                  -- Feedback: Mức độ liên quan đến tình huống
  feedback_naturalness TEXT,                                -- Feedback: Cách diễn đạt tự nhiên hơn
  relevance_status TEXT,                                    -- 'on_topic' | 'minor_off_topic' | 'off_topic' | 'deliberate_off_topic'
  score_change INTEGER NOT NULL DEFAULT 0,                  -- Điểm thay đổi ở lượt này: 0, -10, -25, -35
  focus_score_after INTEGER,                                -- Điểm tập trung sau khi áp dụng lượt này
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_ai_talk_messages_session ON ai_talk_session_messages(session_id, turn_index ASC);
