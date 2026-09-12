CREATE TABLE IF NOT EXISTS sentence_audio (
  id TEXT PRIMARY KEY NOT NULL,
  sentence_id TEXT NOT NULL,
  voice TEXT NOT NULL,
  url TEXT NOT NULL,
  FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sentence_audio_sentence ON sentence_audio(sentence_id);

CREATE TABLE IF NOT EXISTS sentence_image (
  id TEXT PRIMARY KEY NOT NULL,
  sentence_id TEXT NOT NULL,
  url TEXT NOT NULL,
  FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sentence_image_sentence ON sentence_image(sentence_id);

CREATE TABLE IF NOT EXISTS sentence_video (
  id TEXT PRIMARY KEY NOT NULL,
  sentence_id TEXT NOT NULL,
  url TEXT NOT NULL,
  FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sentence_video_sentence ON sentence_video(sentence_id);

CREATE TABLE IF NOT EXISTS lexical_audio (
  id TEXT PRIMARY KEY NOT NULL,
  lexical_id TEXT NOT NULL,
  voice TEXT NOT NULL,
  url TEXT NOT NULL,
  FOREIGN KEY (lexical_id) REFERENCES lexicals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lexical_audio_lexical ON lexical_audio(lexical_id);

CREATE TABLE IF NOT EXISTS lexical_image (
  id TEXT PRIMARY KEY NOT NULL,
  lexical_id TEXT NOT NULL,
  url TEXT NOT NULL,
  FOREIGN KEY (lexical_id) REFERENCES lexicals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lexical_image_lexical ON lexical_image(lexical_id);

CREATE TABLE IF NOT EXISTS lexical_video (
  id TEXT PRIMARY KEY NOT NULL,
  lexical_id TEXT NOT NULL,
  url TEXT NOT NULL,
  FOREIGN KEY (lexical_id) REFERENCES lexicals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lexical_video_lexical ON lexical_video(lexical_id);
