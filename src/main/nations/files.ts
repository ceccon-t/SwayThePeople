/**
 * Nation package files on disk: the JSON form players export from a campaign
 * and (later) bring into a new one. Written pretty-printed so a package stays
 * readable and hand-editable.
 */
import { writeFileSync } from 'node:fs';
import type { NationPackage } from '@core/nation/package';

/** Write a package as JSON, ensuring the .json extension the dialog filter promises. */
export function writeNationPackageFile(filePath: string, pkg: NationPackage): string {
  const target = filePath.toLowerCase().endsWith('.json') ? filePath : `${filePath}.json`;
  writeFileSync(target, JSON.stringify(pkg, null, 2));
  return target;
}
