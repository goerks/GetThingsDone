-- Release 0.1 had four fixed epic colours named after the demo epics.
-- The palette now has eight neutral colour names (see docs/design/tokens.css).
UPDATE epics SET color_key = 'blue' WHERE color_key = 'boards';
UPDATE epics SET color_key = 'amber' WHERE color_key = 'backlog';
UPDATE epics SET color_key = 'teal' WHERE color_key = 'storage';
UPDATE epics SET color_key = 'violet' WHERE color_key = 'accessibility';
