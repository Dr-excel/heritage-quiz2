-- 初期スキーマ

CREATE TABLE courses (
  id          TEXT PRIMARY KEY,           -- 'beginner' | 'intermediate' | 'advanced'
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order  INTEGER NOT NULL
);

-- 世界遺産マスタ
CREATE TABLE heritage_sites (
  id             TEXT PRIMARY KEY,        -- 例: 'jp-himeji'
  name_ja        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  country        TEXT NOT NULL,
  category       TEXT NOT NULL CHECK (category IN ('cultural', 'natural', 'mixed')),
  inscribed_year INTEGER
);

-- 画像メタデータ（本体は R2）
CREATE TABLE images (
  id          INTEGER PRIMARY KEY,
  r2_key      TEXT NOT NULL UNIQUE,
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  alt_text    TEXT NOT NULL,
  credit      TEXT NOT NULL,
  license     TEXT NOT NULL,
  license_url TEXT,
  source_url  TEXT NOT NULL,
  site_id     TEXT REFERENCES heritage_sites (id)
);

CREATE TABLE questions (
  id                   INTEGER PRIMARY KEY,
  course_id            TEXT NOT NULL REFERENCES courses (id),
  site_id              TEXT REFERENCES heritage_sites (id),
  body                 TEXT NOT NULL,
  image_id             INTEGER REFERENCES images (id),
  explanation          TEXT NOT NULL,
  explanation_image_id INTEGER REFERENCES images (id),
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_questions_course_status ON questions (course_id, status);

-- 選択肢（1問につき3つ、正解は1つ）
CREATE TABLE choices (
  id          INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  is_correct  INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  sort_order  INTEGER NOT NULL
);
CREATE INDEX idx_choices_question ON choices (question_id);

-- プレイセッション
CREATE TABLE quiz_sessions (
  id             TEXT PRIMARY KEY,        -- 推測できない UUID
  course_id      TEXT NOT NULL REFERENCES courses (id),
  question_ids   TEXT NOT NULL,           -- JSON 配列（10件）
  answered_count INTEGER NOT NULL DEFAULT 0,
  correct_count  INTEGER NOT NULL DEFAULT 0,
  started_at     INTEGER NOT NULL,        -- UNIX ミリ秒
  finished_at    INTEGER,
  ranked         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_sessions_started ON quiz_sessions (started_at);

-- 回答履歴（同じ位置へ2回回答できないよう主キーで防ぐ）
CREATE TABLE quiz_answers (
  session_id  TEXT NOT NULL REFERENCES quiz_sessions (id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,           -- 1〜10
  question_id INTEGER NOT NULL,
  choice_id   INTEGER NOT NULL,
  is_correct  INTEGER NOT NULL,
  answered_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, position)
);

-- ランキング
CREATE TABLE rankings (
  id            INTEGER PRIMARY KEY,
  session_id    TEXT NOT NULL UNIQUE,     -- 1セッション1回まで
  course_id     TEXT NOT NULL REFERENCES courses (id),
  nickname      TEXT NOT NULL,
  correct_count INTEGER NOT NULL,
  total         INTEGER NOT NULL,
  accuracy      REAL NOT NULL,
  elapsed_ms    INTEGER NOT NULL,
  is_hidden     INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_rankings_board ON rankings (course_id, is_hidden, accuracy DESC, elapsed_ms ASC, created_at ASC);
