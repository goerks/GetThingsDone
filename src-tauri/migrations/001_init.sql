CREATE TABLE epics (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    color_key TEXT NOT NULL
);

CREATE TABLE stories (
    id          TEXT PRIMARY KEY,
    code        TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    epic_id     TEXT NOT NULL REFERENCES epics (id),
    points      INTEGER NOT NULL DEFAULT 1,
    status      TEXT NOT NULL,
    in_sprint   INTEGER NOT NULL DEFAULT 1,
    rank        INTEGER NOT NULL
);

CREATE TABLE criteria (
    id       TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
    text     TEXT NOT NULL,
    done     INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL
);

CREATE INDEX idx_stories_rank ON stories (rank);
CREATE INDEX idx_criteria_story ON criteria (story_id, position);
