-- Sync with Jira (issue #66, phase 5): a sprint has a goal and, when it is connected to a sprint of a service, the service, its id
-- there and what the sprint looked like at the last sync (the base of the three-way comparison, as JSON).
ALTER TABLE sprints ADD COLUMN goal TEXT;
ALTER TABLE sprints ADD COLUMN sync_service TEXT;
ALTER TABLE sprints ADD COLUMN sync_id TEXT;
ALTER TABLE sprints ADD COLUMN sync_base TEXT;
