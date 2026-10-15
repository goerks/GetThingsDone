-- Definition of Ready and Definition of Done (#26).
-- The lists themselves are stored as JSON in the settings table (key 'definitions').
-- stories.checks: JSON object of the manual states by item id ('checked' | 'na'); NULL means none.
-- stories.done_items: JSON array of the Done items that applied when the story became done; NULL means none (never marked).
ALTER TABLE stories ADD COLUMN checks TEXT;
ALTER TABLE stories ADD COLUMN done_items TEXT;
