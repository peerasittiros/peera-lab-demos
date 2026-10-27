/** Client-side ids for ops and rows the visitor creates. The server never sees them until a sync exists. */
export function newId(): string {
  return crypto.randomUUID();
}
