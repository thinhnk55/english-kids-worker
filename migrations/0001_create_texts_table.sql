CREATE TABLE IF NOT EXISTS texts (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  phonemes TEXT,
  tokens TEXT NOT NULL DEFAULT '[]' CHECK (
    json_valid(tokens) AND json_type(tokens) = 'array'
  ),
  translations TEXT NOT NULL DEFAULT '{}' CHECK (
    json_valid(translations) AND json_type(translations) = 'object'
  ),
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (
    json_valid(metadata) AND json_type(metadata) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_texts_text ON texts(text);

CREATE TABLE IF NOT EXISTS sentence_lexicals (
  id TEXT PRIMARY KEY NOT NULL,
  sentence_id TEXT NOT NULL,
  lexical_id TEXT NOT NULL,
  token_indexes TEXT NOT NULL CHECK (
    json_valid(token_indexes)
    AND json_type(token_indexes) = 'array'
    AND json_array_length(token_indexes) > 0
  ),
  display_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (sentence_id) REFERENCES texts(id) ON DELETE CASCADE,
  FOREIGN KEY (lexical_id) REFERENCES texts(id) ON DELETE CASCADE,
  CONSTRAINT uq_sentence_lexical_tokens UNIQUE (sentence_id, lexical_id, token_indexes)
);

CREATE INDEX IF NOT EXISTS idx_sentence_lexicals_sentence ON sentence_lexicals(sentence_id);
CREATE INDEX IF NOT EXISTS idx_sentence_lexicals_lexical ON sentence_lexicals(lexical_id);
