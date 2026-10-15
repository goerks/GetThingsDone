-- Import and sync from GitHub Issues (issue #30). A story that was imported keeps the address of its issue and the state
-- the last sync saw ('open' or 'closed'). Both are NULL for the stories of the team. The repository and the time of the
-- last sync are rows of the settings table (github_repo, github_last_sync); the access token is never stored here.
ALTER TABLE stories ADD COLUMN github_url TEXT;
ALTER TABLE stories ADD COLUMN github_state TEXT;
CREATE INDEX idx_stories_github_url ON stories (github_url);
