CREATE TABLE lexicals (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  tokens TEXT NOT NULL DEFAULT '[]' CHECK (
    json_valid(tokens) AND json_type(tokens) = 'array'
  ),
  translations TEXT NOT NULL DEFAULT '{}' CHECK (
    json_valid(translations) AND json_type(translations) = 'object'
  )
);

CREATE INDEX idx_lexicals_text ON lexicals(text COLLATE NOCASE);
