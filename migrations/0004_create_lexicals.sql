-- =============================================================================
-- ENGLISH KIDS LEXICALS
--
-- A lexical is one learning unit. It can be one word ("cat") or a multi-word
-- chunk ("a cute cat"). Identical text is allowed because its meaning or
-- pronunciation may differ by context.
--
-- Authoring is incremental: create text + translations first, then complete
-- `tokens` when word-level reading data is available. `tokens` keeps lexical
-- token boundaries explicit so the frontend can render and teach reading
-- without re-tokenizing `text`:
--
-- [
--   { "text": "a", "phonemes": "AH0", "graphemes": "a" },
--   { "text": "cute", "phonemes": "K Y,UW1 T", "graphemes": "c,u,te" },
--   { "text": "cat", "phonemes": "K AE1 T", "graphemes": "c,a,t" }
-- ]
--
-- `phonemes` uses the Dictionary Worker alignment format. Within a token,
-- spaces separate grapheme alignment units, commas join sounds represented by
-- one grapheme, and `-` marks a silent grapheme. `graphemes` uses matching
-- comma-separated units. The API validates the token object shape and pairing;
-- SQL only guarantees that this incremental field is a JSON array.
--
-- `pronunciation` is optional Kokoro replacement markup, for example
-- `[read](/ɹˈɛd/)`. It overrides the normal pronunciation only when sending
-- this lexical to TTS; NULL means use `text` normally. Do not derive it from
-- `tokens` or persist a generated value automatically.
--
-- =============================================================================

CREATE TABLE lexicals (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
  text TEXT NOT NULL CHECK (length(trim(text)) > 0),
  tokens TEXT NOT NULL DEFAULT '[]' CHECK (
    json_valid(tokens) AND json_type(tokens) = 'array'
  ),
  pronunciation TEXT,
  translations TEXT NOT NULL DEFAULT '{}' CHECK (
    json_valid(translations) AND json_type(translations) = 'object'
  )
);

CREATE INDEX idx_lexicals_text
  ON lexicals(text COLLATE NOCASE);

-- Keep media contracts separate. `url` is the final delivery URL; the API
-- removes the corresponding R2 object before deleting a media row. RESTRICT
-- prevents deleting a lexical while its media still needs that cleanup.
CREATE TABLE lexicals_audio (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
  lexical_id TEXT NOT NULL,
  url TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  FOREIGN KEY (lexical_id) REFERENCES lexicals(id) ON DELETE RESTRICT
);

CREATE INDEX idx_lexicals_audio_lexical
  ON lexicals_audio(lexical_id);

-- One lexical can have distinct illustrations for separate learning uses.
CREATE TABLE lexicals_image (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
  lexical_id TEXT NOT NULL,
  url TEXT NOT NULL,
  purpose TEXT NOT NULL,
  FOREIGN KEY (lexical_id) REFERENCES lexicals(id) ON DELETE RESTRICT
);

CREATE INDEX idx_lexicals_image_lexical
  ON lexicals_image(lexical_id);

-- Video remains separate from images but uses the same purpose contract.
CREATE TABLE lexicals_video (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
  lexical_id TEXT NOT NULL,
  url TEXT NOT NULL,
  purpose TEXT NOT NULL,
  FOREIGN KEY (lexical_id) REFERENCES lexicals(id) ON DELETE RESTRICT
);

CREATE INDEX idx_lexicals_video_lexical
  ON lexicals_video(lexical_id);
