-- Default values of custom fields (issue #4, stage 3). JSON of the value: a string, a number or an option id.
ALTER TABLE field_definitions ADD COLUMN default_value TEXT;
