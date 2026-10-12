-- Release planning (issue #10, phase 1). A release has a title and a description, and optional start and end days.
-- A story belongs to at most one release: stories.release_id is NULL for none.
CREATE TABLE releases (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    start_date  TEXT,             -- YYYY-MM-DD, local calendar day, optional
    end_date    TEXT              -- YYYY-MM-DD, included in the release, optional
);

ALTER TABLE stories ADD COLUMN release_id TEXT REFERENCES releases (id);

CREATE INDEX idx_stories_release ON stories (release_id);
