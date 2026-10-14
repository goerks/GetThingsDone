-- Start and complete a sprint (issue #17). A sprint is planned, running (at most one) or completed.
-- state is NULL for the sprints of earlier versions: the app gives them a state by their dates when it loads
-- (the sprint that includes today runs, earlier ones are completed with their result, later ones are planned).
ALTER TABLE sprints ADD COLUMN state TEXT;       -- 'planned' | 'running' | 'completed' | NULL
ALTER TABLE sprints ADD COLUMN start_items TEXT; -- JSON: the stories (id, code, points) in the sprint when it was started
ALTER TABLE sprints ADD COLUMN result TEXT;      -- JSON: what the sprint achieved, set when it is completed
