-- Configurable status values (issue #5): the columns of the board. stories.status holds the id of a status value.
-- The four statuses that were fixed so far become the defaults; their label stays NULL, so the app shows the
-- translated name until the team renames them.
CREATE TABLE status_values (
    id       TEXT PRIMARY KEY,
    label    TEXT,              -- NULL: translated default name
    category TEXT NOT NULL,     -- 'not_started' | 'in_progress' | 'done'
    position INTEGER NOT NULL   -- board order
);

INSERT INTO status_values (id, label, category, position) VALUES
    ('todo', NULL, 'not_started', 0),
    ('in_progress', NULL, 'in_progress', 1),
    ('review', NULL, 'in_progress', 2),
    ('done', NULL, 'done', 3);
