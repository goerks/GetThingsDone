import { PACKAGE_1 } from './package1';
import { PACKAGE_24 } from './package24';
import { PACKAGE_30 } from './package30';

/** The acceptance packages by issue. The preview shows the current one; `?package=<issue>` picks an earlier one (for the tests of the panel). */
export const PACKAGES = { 32: PACKAGE_1, 24: PACKAGE_24, 30: PACKAGE_30 } as const;

/** The package of the pull request this build belongs to. */
export const CURRENT_PACKAGE = PACKAGE_30;

export function selectPackage(search: string): typeof PACKAGE_1 | typeof PACKAGE_24 | typeof PACKAGE_30 {
  const wanted = Number(new URLSearchParams(search).get('package'));
  return (PACKAGES as Record<number, typeof CURRENT_PACKAGE>)[wanted] ?? CURRENT_PACKAGE;
}
