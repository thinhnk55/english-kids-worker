CREATE TABLE IF NOT EXISTS taxonomies (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  translations TEXT NOT NULL DEFAULT '{}'
    CHECK (json_valid(translations) AND json_type(translations) = 'object'),
  selection_mode TEXT NOT NULL DEFAULT 'multiple'
    CHECK (selection_mode IN ('single', 'multiple'))
);

CREATE TABLE IF NOT EXISTS taxonomy_terms (
  id TEXT PRIMARY KEY NOT NULL,
  taxonomy_id TEXT NOT NULL,
  parent_id TEXT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  translations TEXT NOT NULL DEFAULT '{}'
    CHECK (json_valid(translations) AND json_type(translations) = 'object'),
  position INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (taxonomy_id) REFERENCES taxonomies(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id, taxonomy_id) REFERENCES taxonomy_terms(id, taxonomy_id) ON DELETE CASCADE,
  UNIQUE (taxonomy_id, code),
  UNIQUE (id, taxonomy_id)
);

CREATE TABLE IF NOT EXISTS sentence_terms (
  sentence_id TEXT NOT NULL,
  term_id TEXT NOT NULL,
  PRIMARY KEY (sentence_id, term_id),
  FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE,
  FOREIGN KEY (term_id) REFERENCES taxonomy_terms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lexical_terms (
  lexical_id TEXT NOT NULL,
  term_id TEXT NOT NULL,
  PRIMARY KEY (lexical_id, term_id),
  FOREIGN KEY (lexical_id) REFERENCES lexicals(id) ON DELETE CASCADE,
  FOREIGN KEY (term_id) REFERENCES taxonomy_terms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_parent ON taxonomy_terms(taxonomy_id, parent_id, position);
CREATE INDEX IF NOT EXISTS idx_sentence_terms_term ON sentence_terms(term_id, sentence_id);
CREATE INDEX IF NOT EXISTS idx_lexical_terms_term ON lexical_terms(term_id, lexical_id);
