-- Change log of the items (issue #23, ADR 0004): one row per version of a story, epic, sprint or release.
-- A version is one save; it keeps the whole tracked state of the item afterwards as JSON, so two versions can be compared.
-- item_id has no foreign key: the item types are separate tables, and the app deletes the versions of a deleted item itself.
CREATE TABLE change_log (
    id        TEXT PRIMARY KEY,
    at        TEXT NOT NULL,      -- ISO timestamp (UTC)
    item_type TEXT NOT NULL,      -- 'story' | 'epic' | 'sprint' | 'release' | later the key of a custom item type
    item_id   TEXT NOT NULL,
    version   INTEGER NOT NULL,   -- 1 for the first version of the item, then counting up
    origin    TEXT NOT NULL,      -- 'created' | 'baseline' | 'changed'
    keys      TEXT NOT NULL,      -- JSON array of the keys this version changed
    state     TEXT NOT NULL       -- JSON object with the tracked values
);

CREATE UNIQUE INDEX idx_change_log_item ON change_log (item_type, item_id, version);
