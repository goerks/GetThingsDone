import { EMPTY_DEFINITIONS } from '../domain/definitions';
import type { Snapshot } from '../domain/types';

/** The demo data without the demo Definition of Ready and Done, for tests of other features that change the status of stories. */
export function withoutDefinitions(snapshot: Snapshot): Snapshot {
  return { ...snapshot, settings: { ...snapshot.settings, definitions: EMPTY_DEFINITIONS } };
}
