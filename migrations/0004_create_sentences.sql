CREATE TABLE sentences (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  tokens TEXT NOT NULL DEFAULT '[]' CHECK (
    json_valid(tokens) AND json_type(tokens) = 'array'
  ),
  translations TEXT NOT NULL DEFAULT '{}' CHECK (
    json_valid(translations) AND json_type(translations) = 'object'
  )
);

CREATE INDEX idx_sentences_text ON sentences(text);

CREATE TABLE sentence_lexicals (
  id TEXT PRIMARY KEY NOT NULL,
  sentence_id TEXT NOT NULL,
  lexical_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  token_indexes TEXT NOT NULL CHECK (
    json_valid(token_indexes)
    AND json_type(token_indexes) = 'array'
    AND json_array_length(token_indexes) > 0
  ),
  FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE,
  FOREIGN KEY (lexical_id) REFERENCES lexicals(id) ON DELETE CASCADE,
  CONSTRAINT uq_sentence_lexicals UNIQUE (sentence_id, lexical_id, token_indexes)
);

CREATE INDEX idx_sentence_lexicals_sentence ON sentence_lexicals(sentence_id);
CREATE INDEX idx_sentence_lexicals_lexical ON sentence_lexicals(lexical_id);
