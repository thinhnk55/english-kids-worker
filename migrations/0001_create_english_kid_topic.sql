CREATE TABLE english_kid_topic (
  code TEXT PRIMARY KEY NOT NULL CHECK (
    code = lower(code)
    AND code GLOB '[a-z0-9]*'
    AND code NOT GLOB '*[^a-z0-9_-]*'
  ),
  parent_code TEXT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT,
  translations TEXT NOT NULL DEFAULT '{}' CHECK (
    json_valid(translations) AND json_type(translations) = 'object'
  ),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  FOREIGN KEY (parent_code) REFERENCES english_kid_topic(code)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE INDEX idx_english_kid_topic_parent_position
  ON english_kid_topic(parent_code, position, code);
