/** Client ids for rows and ops: random UUIDs, so ids made in two tabs never collide. */
export function newId(): string {
  return globalThis.crypto.randomUUID();
}
