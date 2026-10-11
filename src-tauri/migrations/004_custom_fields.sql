-- Configurable fields (ADR 0003, issue #4).

-- A story no longer needs an epic. SQLite cannot drop NOT NULL in place, so the table is rebuilt.
-- The criteria table is rebuilt as well and dropped first: dropping stories while criteria still
-- references it would delete every criterion through ON DELETE CASCADE.
CREATE TABLE criteria_old AS SELECT * FROM criteria;
CREATE TABLE stories_old AS SELECT * FROM stories;
DROP TABLE criteria;
DROP TABLE stories;

-- The rebuild also drops stories.in_sprint, which migration 003 replaced by sprint_id.
CREATE TABLE stories (
    id          TEXT PRIMARY KEY,
    code        TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    epic_id     TEXT REFERENCES epics (id),
    points      INTEGER NOT NULL DEFAULT 1,
    status      TEXT NOT NULL,
    sprint_id   TEXT REFERENCES sprints (id),
    rank        INTEGER NOT NULL
);
INSERT INTO stories (id, code, title, description, epic_id, points, status, sprint_id, rank)
    SELECT id, code, title, description, epic_id, points, status, sprint_id, rank FROM stories_old;

CREATE TABLE criteria (
    id       TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
    text     TEXT NOT NULL,
    done     INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL
);
INSERT INTO criteria (id, story_id, text, done, position)
    SELECT id, story_id, text, done, position FROM criteria_old;

DROP TABLE criteria_old;
DROP TABLE stories_old;
CREATE INDEX idx_stories_rank ON stories (rank);
CREATE INDEX idx_stories_sprint ON stories (sprint_id);
CREATE INDEX idx_criteria_story ON criteria (story_id, position);

-- The field library. System and built-in fields are added by the app when missing.
CREATE TABLE field_definitions (
    id          TEXT PRIMARY KEY,
    builtin_key TEXT UNIQUE,
    kind        TEXT NOT NULL,
    data_type   TEXT NOT NULL,
    label       TEXT
);

CREATE TABLE field_options (
    id        TEXT PRIMARY KEY,
    field_id  TEXT NOT NULL REFERENCES field_definitions (id) ON DELETE CASCADE,
    label     TEXT NOT NULL,
    color_key TEXT NOT NULL,
    position  INTEGER NOT NULL
);

CREATE TABLE field_assignments (
    item_type TEXT NOT NULL,
    field_id  TEXT NOT NULL REFERENCES field_definitions (id) ON DELETE CASCADE,
    position  INTEGER NOT NULL,
    required  INTEGER NOT NULL DEFAULT 0,
    hidden    INTEGER NOT NULL DEFAULT 0,
    on_card   INTEGER NOT NULL DEFAULT 0,
    in_create INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (item_type, field_id)
);

-- One row per item and field. item_id points to an epic or a story, so it has no foreign key;
-- the app deletes the values of an item together with the item.
CREATE TABLE field_values (
    item_id      TEXT NOT NULL,
    field_id     TEXT NOT NULL REFERENCES field_definitions (id) ON DELETE CASCADE,
    text_value   TEXT,
    number_value REAL,
    option_id    TEXT REFERENCES field_options (id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, field_id)
);

CREATE INDEX idx_field_options_field ON field_options (field_id, position);
CREATE INDEX idx_field_values_field ON field_values (field_id);
