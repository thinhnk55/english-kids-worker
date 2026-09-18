CREATE TABLE english_kid_topic (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT,
  image TEXT,
  translations TEXT NOT NULL DEFAULT '{}' CHECK (
    json_valid(translations) AND json_type(translations) = 'object'
  )
);
