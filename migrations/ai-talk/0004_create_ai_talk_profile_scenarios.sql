-- 4. Bảng liên kết hồ sơ người học với kịch bản (Profile Scenario Mapping)
-- Lưu trữ thông tin tiến độ của từng profile với từng kịch bản cụ thể (điểm cao nhất, số phiên đã học, ...)
-- Toàn bộ nội dung lưu trữ trong meta JSON để FE toàn quyền quyết định logic
CREATE TABLE ai_talk_profile_scenarios (
  profile_id INTEGER NOT NULL,                                 -- ID hồ sơ người học
  scenario_id TEXT NOT NULL,                                   -- Mã kịch bản
  meta TEXT,                                                   -- JSON lưu thông số (best_score, sessions_count, last_completed_at, ...)
  created_at INTEGER NOT NULL,                                 -- Unix timestamp tạo
  updated_at INTEGER NOT NULL,                                 -- Unix timestamp cập nhật gần nhất
  PRIMARY KEY (profile_id, scenario_id)
);

CREATE INDEX idx_ai_talk_profile_scenarios_profile ON ai_talk_profile_scenarios(profile_id);
