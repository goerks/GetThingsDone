-- Estimating with cards (#54).
-- stories.estimate: the card of the story as text: a number ('1', '2', '3', '5', '8', '13', '21'), a special card
-- ('unsure' for "?", 'break' for the coffee cup) or NULL when the story is not estimated. stories.points stays for
-- older versions and holds the number or 0.
-- Stories used to get 3 points when they were created, which cannot be told from a deliberate 3: they become "not
-- estimated", like stories with 0 points.
-- stories.reference: 1 when the story is the reference of the card value of its estimate (at most one per value).
-- epics.size: the T-shirt size of the epic ('XS', 'S', 'M', 'L', 'XL') or NULL.
ALTER TABLE stories ADD COLUMN estimate TEXT;
ALTER TABLE stories ADD COLUMN reference INTEGER NOT NULL DEFAULT 0;
ALTER TABLE epics ADD COLUMN size TEXT;
UPDATE stories SET estimate = CAST(points AS TEXT) WHERE points NOT IN (0, 3);
UPDATE stories SET points = 0 WHERE points = 3;
