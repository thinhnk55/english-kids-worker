CREATE TABLE IF NOT EXISTS texts (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  translations TEXT NOT NULL DEFAULT '{}' CHECK (
    json_valid(translations) AND json_type(translations) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_texts_text ON texts(text);
