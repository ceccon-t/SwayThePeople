/**
 * Nation package files on disk: the JSON form players export from a campaign
 * and bring into a new one. Written pretty-printed so a package stays readable
 * and hand-editable; read as untrusted input, with schema failures turned into
 * a message a player can act on.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { NationPackage } from '@core/nation/package';
import { nationPackageSchema } from '@core/nation/package';

/** Write a package as JSON, ensuring the .json extension the dialog filter promises. */
export function writeNationPackageFile(filePath: string, pkg: NationPackage): string {
  const target = filePath.toLowerCase().endsWith('.json') ? filePath : `${filePath}.json`;
  writeFileSync(target, JSON.stringify(pkg, null, 2));
  return target;
}

/** Parse and validate a package file; throws a readable error for anything unusable. */
export function readNationPackageFile(filePath: string): NationPackage {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (error) {
    throw new Error(`Could not read a nation package from this file: ${(error as Error).message}`);
  }
  const parsed = nationPackageSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length > 0 ? ` (at ${issue.path.join('.')})` : '';
    throw new Error(`This file is not a valid nation package: ${issue.message}${where}.`);
  }
  return parsed.data;
}
