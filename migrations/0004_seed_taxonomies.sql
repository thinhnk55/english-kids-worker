-- Seed core taxonomies: CEFR, Kind, Topic

INSERT OR IGNORE INTO taxonomies (id, code, name, description, translations, selection_mode) VALUES
  ('taxonomy-cefr', 'cefr', 'CEFR', 'Common European Framework of Reference for Languages level', '{"vi":{"name":"Trình độ CEFR","description":"Khung tham chiếu trình độ ngôn ngữ chung châu Âu"}}', 'single'),
  ('taxonomy-kind', 'kind', 'Kind', 'Classification of text type (vocabulary, phrase, sentence, etc.)', '{"vi":{"name":"Loại nội dung","description":"Phân loại kiểu nội dung (từ vựng, cụm từ, câu,...)"}}', 'single'),
  ('taxonomy-topic', 'topic', 'Topic', 'Thematic category or subject area', '{"vi":{"name":"Chủ đề","description":"Chủ đề bài học hoặc lĩnh vực nội dung"}}', 'multiple');

-- Seed CEFR terms
INSERT OR IGNORE INTO taxonomy_terms
  (id, taxonomy_id, parent_id, code, name, description, translations, position)
VALUES
  ('cefr-a1', 'taxonomy-cefr', NULL, 'a1', 'A1', 'Beginner / Pre-A1 level', '{"vi":{"name":"A1","description":"Trình độ nhập môn / căn bản"}}', 0),
  ('cefr-a2', 'taxonomy-cefr', NULL, 'a2', 'A2', 'Elementary level', '{"vi":{"name":"A2","description":"Trình độ sơ cấp"}}', 1),
  ('cefr-b1', 'taxonomy-cefr', NULL, 'b1', 'B1', 'Intermediate level', '{"vi":{"name":"B1","description":"Trình độ trung cấp"}}', 2),
  ('cefr-b2', 'taxonomy-cefr', NULL, 'b2', 'B2', 'Upper-Intermediate level', '{"vi":{"name":"B2","description":"Trình độ trung cao cấp"}}', 3),
  ('cefr-c1', 'taxonomy-cefr', NULL, 'c1', 'C1', 'Advanced level', '{"vi":{"name":"C1","description":"Trình độ cao cấp"}}', 4),
  ('cefr-c2', 'taxonomy-cefr', NULL, 'c2', 'C2', 'Proficient level', '{"vi":{"name":"C2","description":"Trình độ thành thạo"}}', 5);

-- Seed Kind terms
INSERT OR IGNORE INTO taxonomy_terms
  (id, taxonomy_id, parent_id, code, name, description, translations, position)
VALUES
  ('kind-vocabulary', 'taxonomy-kind', NULL, 'vocabulary', 'Vocabulary', 'Single word vocabulary item', '{"vi":{"name":"Từ vựng","description":"Từ đơn lẻ"}}', 0),
  ('kind-phrase', 'taxonomy-kind', NULL, 'phrase', 'Phrase', 'Common multi-word expression or phrase', '{"vi":{"name":"Cụm từ","description":"Cụm từ thông dụng"}}', 1),
  ('kind-collocation', 'taxonomy-kind', NULL, 'collocation', 'Collocation', 'Natural word combination', '{"vi":{"name":"Kết hợp từ","description":"Cụm từ hay đi cùng nhau"}}', 2),
  ('kind-phrasal-verb', 'taxonomy-kind', NULL, 'phrasal_verb', 'Phrasal Verb', 'Verb + preposition/adverb combination', '{"vi":{"name":"Cụm động từ","description":"Động từ đi kèm giới từ/trạng từ"}}', 3),
  ('kind-idiom', 'taxonomy-kind', NULL, 'idiom', 'Idiom', 'Idiomatic expression', '{"vi":{"name":"Thành ngữ","description":"Thành ngữ"}}', 4),
  ('kind-pattern', 'taxonomy-kind', NULL, 'pattern', 'Sentence Pattern', 'Grammatical sentence structure pattern', '{"vi":{"name":"Mẫu câu","description":"Cấu trúc mẫu câu"}}', 5),
  ('kind-sentence', 'taxonomy-kind', NULL, 'sentence', 'Full Sentence', 'Complete standalone sentence', '{"vi":{"name":"Câu hoàn chỉnh","description":"Câu giao tiếp hoàn chỉnh"}}', 6);

-- Seed Topic terms (popular topics for Kids English)
INSERT OR IGNORE INTO taxonomy_terms
  (id, taxonomy_id, parent_id, code, name, description, translations, position)
VALUES
  ('topic-animals', 'taxonomy-topic', NULL, 'animals', 'Animals', 'Animals, pets, and wildlife', '{"vi":{"name":"Động vật","description":"Động vật, thú cưng và thế giới tự nhiên"}}', 0),
  ('topic-family', 'taxonomy-topic', NULL, 'family', 'Family & Friends', 'Family members and relationships', '{"vi":{"name":"Gia đình & Bạn bè","description":"Thành viên gia đình và các mối quan hệ"}}', 1),
  ('topic-colors', 'taxonomy-topic', NULL, 'colors', 'Colors & Shapes', 'Colors, patterns, and geometric shapes', '{"vi":{"name":"Màu sắc & Hình khối","description":"Màu sắc và các hình khối cơ bản"}}', 2),
  ('topic-numbers', 'taxonomy-topic', NULL, 'numbers', 'Numbers & Counting', 'Numbers, counting, and math basics', '{"vi":{"name":"Số đếm","description":"Chữ số và tập đếm"}}', 3),
  ('topic-food', 'taxonomy-topic', NULL, 'food', 'Food & Drinks', 'Meals, fruits, vegetables, and beverages', '{"vi":{"name":"Thức ăn & Đồ uống","description":"Món ăn, trái cây và đồ uống"}}', 4),
  ('topic-body', 'taxonomy-topic', NULL, 'body', 'Body & Health', 'Human body parts, senses, and health', '{"vi":{"name":"Cơ thể & Sức khỏe","description":"Các bộ phận cơ thể và sức khỏe"}}', 5),
  ('topic-school', 'taxonomy-topic', NULL, 'school', 'School & Learning', 'Classroom, stationery, and learning', '{"vi":{"name":"Trường học & Học tập","description":"Đồ dùng học tập và trường lớp"}}', 6),
  ('topic-home', 'taxonomy-topic', NULL, 'home', 'House & Home', 'Rooms, furniture, and household items', '{"vi":{"name":"Nhà cửa & Đồ đạc","description":"Phòng ở và đồ dùng trong nhà"}}', 7),
  ('topic-clothes', 'taxonomy-topic', NULL, 'clothes', 'Clothes & Accessories', 'Clothing, shoes, and accessories', '{"vi":{"name":"Quần áo & Phụ kiện","description":"Trang phục và phụ kiện"}}', 8),
  ('topic-nature', 'taxonomy-topic', NULL, 'nature', 'Nature & Weather', 'Seasons, weather, plants, and environment', '{"vi":{"name":"Thiên nhiên & Thời tiết","description":"Các mùa, thời tiết và thiên nhiên"}}', 9),
  ('topic-sports', 'taxonomy-topic', NULL, 'sports', 'Sports & Hobbies', 'Games, sports, and free-time activities', '{"vi":{"name":"Thể thao & Sở thích","description":"Môn thể thao và trò chơi giải trí"}}', 10),
  ('topic-jobs', 'taxonomy-topic', NULL, 'jobs', 'Jobs & Professions', 'Occupations and community helpers', '{"vi":{"name":"Nghề nghiệp","description":"Các ngành nghề trong xã hội"}}', 11),
  ('topic-emotions', 'taxonomy-topic', NULL, 'emotions', 'Feelings & Emotions', 'Emotions, moods, and feelings', '{"vi":{"name":"Cảm xúc","description":"Tâm trạng và cảm xúc"}}', 12),
  ('topic-travel', 'taxonomy-topic', NULL, 'travel', 'Transport & Travel', 'Vehicles, transportation, and places', '{"vi":{"name":"Phương tiện & Du lịch","description":"Phương tiện giao thông và địa điểm"}}', 13);
