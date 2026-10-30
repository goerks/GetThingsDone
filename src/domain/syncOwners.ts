import type { Settings } from './types';

/*
 * What the connected service decides (#66, phase 5): with Jira connected, the columns of the board, the team and the state of
 * the sprints come from Jira and cannot be changed here. GitHub has none of these, so it owns nothing.
 */

const connected = (settings: Settings): boolean => settings.features.sync && Object.keys(settings.sync.connection).length > 0;

/** Whether the columns of the board come from the service. */
export const columnsFromService = (settings: Settings): boolean => connected(settings) && settings.sync.service === 'jira';

/** Whether the team comes from the service. */
export const teamFromService = (settings: Settings): boolean => connected(settings) && settings.sync.service === 'jira';
