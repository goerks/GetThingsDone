import { PACKAGE_1 } from './package1';
import { PACKAGE_16 } from './package16';
import { PACKAGE_18 } from './package18';
import { PACKAGE_23 } from './package23';
import { PACKAGE_24 } from './package24';
import { PACKAGE_26 } from './package26';
import { PACKAGE_55 } from './package55';
import { PACKAGE_61 } from './package61';
import { PACKAGE_30 } from './package30';
import { PACKAGE_70 } from './package70';
import { PACKAGE_66 } from './package66';
import { PACKAGE_49 } from './package49';

/** The acceptance packages by issue. The preview shows the current one; `?package=<issue>` picks an earlier one (for the tests of the panel). */
export const PACKAGES = { 32: PACKAGE_1, 24: PACKAGE_24, 26: PACKAGE_26, 16: PACKAGE_16, 23: PACKAGE_23, 18: PACKAGE_18, 55: PACKAGE_55, 61: PACKAGE_61, 30: PACKAGE_30, 70: PACKAGE_70, 66: PACKAGE_66, 49: PACKAGE_49 } as const;

/** The package of the pull request this build belongs to. */
export const CURRENT_PACKAGE = PACKAGE_49;

export function selectPackage(search: string): typeof CURRENT_PACKAGE {
  const wanted = Number(new URLSearchParams(search).get('package'));
  return (PACKAGES as Record<number, typeof CURRENT_PACKAGE>)[wanted] ?? CURRENT_PACKAGE;
}
