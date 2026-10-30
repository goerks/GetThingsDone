-- Sync with several services (issue #66): the link of a story is no longer GitHub specific. The columns keep their data and
-- get generic names; `sync_service` says which service the link belongs to and `sync_key` how the issue is called there
-- (`#31`), which is shown as the ID of the story.
ALTER TABLE stories RENAME COLUMN github_url TO sync_url;
ALTER TABLE stories RENAME COLUMN github_state TO sync_state;
ALTER TABLE stories RENAME COLUMN github_base TO sync_base;
ALTER TABLE stories ADD COLUMN sync_service TEXT;
ALTER TABLE stories ADD COLUMN sync_key TEXT;
-- Every link made so far points to a GitHub issue; its key is the number at the end of the address, with a hash.
UPDATE stories SET sync_service = 'github', sync_key = '#' || replace(sync_url, rtrim(sync_url, '0123456789'), '') WHERE sync_url IS NOT NULL;
DROP INDEX idx_stories_github_url;
CREATE INDEX idx_stories_sync_url ON stories (sync_url);

-- The settings of the connection: `github_*` becomes `sync_*`, the repository becomes the connection of the chosen service.
UPDATE settings SET key = 'sync_write' WHERE key = 'github_write';
UPDATE settings SET key = 'sync_conflict' WHERE key = 'github_conflict';
UPDATE settings SET key = 'sync_ignored' WHERE key = 'github_ignored';
UPDATE settings SET key = 'sync_managed' WHERE key = 'github_managed';
UPDATE settings SET key = 'sync_auto' WHERE key = 'github_auto';
UPDATE settings SET key = 'sync_log' WHERE key = 'github_log';
UPDATE settings SET key = 'sync_last_sync' WHERE key = 'github_last_sync';
UPDATE settings SET key = 'feature_sync' WHERE key = 'feature_github';
INSERT INTO settings (key, value) SELECT 'sync_connection', json_object('repo', value) FROM settings WHERE key = 'github_repo' AND value <> '';
INSERT INTO settings (key, value) SELECT 'sync_service', 'github' FROM settings WHERE key = 'github_repo' AND value <> '';
DELETE FROM settings WHERE key = 'github_repo';
