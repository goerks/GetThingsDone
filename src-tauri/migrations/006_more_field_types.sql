-- More field types (issue #4, stage 4): dates get their own column, multi selects one row per chosen option.
-- Checkboxes use number_value (1 = ticked), links use text_value.
ALTER TABLE field_values ADD COLUMN date_value TEXT;

CREATE TABLE field_value_options (
    item_id   TEXT NOT NULL,
    field_id  TEXT NOT NULL REFERENCES field_definitions (id) ON DELETE CASCADE,
    option_id TEXT NOT NULL REFERENCES field_options (id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, field_id, option_id)
);
