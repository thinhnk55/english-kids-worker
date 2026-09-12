CREATE TABLE IF NOT EXISTS lexicals (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'vocabulary' CHECK (
    type IN ('vocabulary', 'phrase', 'collocation', 'phrasal_verb', 'idiom', 'pattern')
  ),
  phonemes TEXT,
  translations TEXT NOT NULL DEFAULT '{}' CHECK (
    json_valid(translations) AND json_type(translations) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_lexicals_text_type ON lexicals(text COLLATE NOCASE, type);
CREATE INDEX IF NOT EXISTS idx_lexicals_type ON lexicals(type);
CREATE INDEX IF NOT EXISTS idx_lexicals_text ON lexicals(text);

CREATE TABLE IF NOT EXISTS sentences (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  phonemes TEXT,
  tokens TEXT NOT NULL DEFAULT '[]' CHECK (
    json_valid(tokens) AND json_type(tokens) = 'array'
  ),
  translations TEXT NOT NULL DEFAULT '{}' CHECK (
    json_valid(translations) AND json_type(translations) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_sentences_text ON sentences(text);

CREATE TABLE IF NOT EXISTS sentence_lexicals (
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

CREATE INDEX IF NOT EXISTS idx_sentence_lexicals_sentence ON sentence_lexicals(sentence_id);
CREATE INDEX IF NOT EXISTS idx_sentence_lexicals_lexical ON sentence_lexicals(lexical_id);
