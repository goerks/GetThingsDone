-- History of the releases (issue #10, phase 3): append-only entries about the stories of a release. They feed the
-- scope report and, later, the burndown. Entries are added, never changed; a deleted release takes its history with it.
CREATE TABLE release_events (
    id         TEXT PRIMARY KEY,
    at         TEXT NOT NULL,     -- ISO timestamp (UTC)
    release_id TEXT NOT NULL REFERENCES releases (id) ON DELETE CASCADE,
    story_id   TEXT NOT NULL,     -- no foreign key: the entry outlives a deleted story
    code       TEXT NOT NULL,     -- key of the story at that time
    kind       TEXT NOT NULL,     -- 'baseline' | 'added' | 'removed' | 'points' | 'done' | 'reopened'
    points     INTEGER NOT NULL,  -- points of the story after the entry
    done       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_release_events_release ON release_events (release_id, at);
