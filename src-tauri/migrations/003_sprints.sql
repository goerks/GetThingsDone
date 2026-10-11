-- Sprints become their own table. Release 0.1 had one fixed "Sprint 1" (stories.in_sprint).
CREATE TABLE sprints (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    start_date TEXT NOT NULL, -- YYYY-MM-DD, local calendar day
    end_date   TEXT NOT NULL  -- YYYY-MM-DD, included in the sprint
);

ALTER TABLE stories ADD COLUMN sprint_id TEXT REFERENCES sprints (id);
ALTER TABLE epics ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

-- The old fixed sprint becomes a real one running from today for two weeks,
-- but only if a story was in it (on an empty database the demo data creates its own sprints).
INSERT INTO sprints (id, name, start_date, end_date)
SELECT 'sprint-1', 'Sprint 1', date('now', 'localtime'), date('now', 'localtime', '+13 days')
WHERE EXISTS (SELECT 1 FROM stories WHERE in_sprint = 1);

UPDATE stories SET sprint_id = 'sprint-1' WHERE in_sprint = 1;

-- Keep the former alphabetical order of the epics as their column order.
UPDATE epics SET position = (SELECT COUNT(*) FROM epics AS other WHERE other.name < epics.name);

-- stories.in_sprint is no longer read; it stays because older SQLite versions cannot drop columns.

CREATE INDEX idx_stories_sprint ON stories (sprint_id);
