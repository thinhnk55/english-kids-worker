CREATE TABLE IF NOT EXISTS text_audio (
  id TEXT PRIMARY KEY NOT NULL,
  texts_id TEXT NOT NULL,
  voice TEXT NOT NULL,
  url TEXT NOT NULL,
  FOREIGN KEY (texts_id) REFERENCES texts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_text_audio_texts_id ON text_audio(texts_id);

CREATE TABLE IF NOT EXISTS text_image (
  id TEXT PRIMARY KEY NOT NULL,
  texts_id TEXT NOT NULL,
  url TEXT NOT NULL,
  FOREIGN KEY (texts_id) REFERENCES texts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_text_image_texts_id ON text_image(texts_id);

CREATE TABLE IF NOT EXISTS text_video (
  id TEXT PRIMARY KEY NOT NULL,
  texts_id TEXT NOT NULL,
  url TEXT NOT NULL,
  FOREIGN KEY (texts_id) REFERENCES texts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_text_video_texts_id ON text_video(texts_id);
