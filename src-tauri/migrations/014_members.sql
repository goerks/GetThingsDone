-- Team members and assignment of stories (issue #18).
-- A member is a plain entry of the team list, not a user account. The initials have at most three characters.
-- stories.assignee_id: the member a story is assigned to; NULL means nobody. No foreign key: the app unassigns the
-- stories of a member itself when it deletes the member, like it does for releases.
CREATE TABLE members (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    initials TEXT NOT NULL,
    position INTEGER NOT NULL
);

ALTER TABLE stories ADD COLUMN assignee_id TEXT;
