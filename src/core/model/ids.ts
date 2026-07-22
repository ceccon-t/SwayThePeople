/**
 * Entity ids are random (not derived from the seeded game RNG): they never
 * influence simulation outcomes, only identity.
 */
export function newId(prefix: string): string {
  return `${prefix}_${globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}
