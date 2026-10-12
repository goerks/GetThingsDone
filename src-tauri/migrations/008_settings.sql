-- Workspace settings (issue #10, phase 2): one row per setting, for example map_rows = 'sprints' | 'releases'.
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
