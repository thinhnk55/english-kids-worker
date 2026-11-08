-- 3. Bảng tình huống đã công khai (Published Scenarios): tách riêng để phục vụ người học, snapshot JSON toàn vẹn
CREATE TABLE ai_talk_published_scenarios (
  scenario_id INTEGER PRIMARY KEY REFERENCES ai_talk_scenarios(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,                                    -- Snapshot JSON đầy đủ: tình huống + danh sách nhiệm vụ
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  published_by TEXT,
  published_at INTEGER NOT NULL
);

CREATE INDEX idx_ai_talk_published_slug ON ai_talk_published_scenarios(slug);
