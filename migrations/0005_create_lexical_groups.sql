-- =============================================================================
-- LEXICAL GROUPS
--
-- A lexical group is an authored learning set, for example "Farm animals" or
-- "Colours at home". It belongs to one English-kids topic and references
-- reusable lexical records through `lexical_group_lexicals`.
--
-- `image` is the group's illustration URL. `audio` reads the group name. Each
-- group intentionally has one file for each of these learning uses.
--
-- The group deliberately stores only its own learning content. A lexical can
-- appear in several groups without being copied, and the mapping has no
-- position: activities may choose their own presentation order rather than
-- inheriting a hidden authoring order from the database.
--
-- Topics and lexicals cannot be deleted while a group still references them.
-- Remove or move the group/mapping first, so content is never deleted by
-- accident when it remains part of another learning set.
-- =============================================================================

CREATE TABLE lexical_groups (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
  topic_id INTEGER NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT,
  image TEXT,
  audio TEXT,
  translations TEXT NOT NULL DEFAULT '{}' CHECK (
    json_valid(translations) AND json_type(translations) = 'object'
  ),
  FOREIGN KEY (topic_id) REFERENCES english_kid_topic(id) ON DELETE RESTRICT
);

CREATE INDEX idx_lexical_groups_topic
  ON lexical_groups(topic_id);

CREATE INDEX idx_lexical_groups_name
  ON lexical_groups(name COLLATE NOCASE);

CREATE TABLE lexical_group_lexicals (
  lexical_group_id TEXT NOT NULL,
  lexical_id TEXT NOT NULL,
  PRIMARY KEY (lexical_group_id, lexical_id),
  FOREIGN KEY (lexical_group_id) REFERENCES lexical_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (lexical_id) REFERENCES lexicals(id) ON DELETE RESTRICT
);

CREATE INDEX idx_lexical_group_lexicals_lexical
  ON lexical_group_lexicals(lexical_id);
