/** Time-ordered unique id (sortable by creation time), safe for the server id regex. */
export function newId(prefix = ''): string {
  const t = Date.now().toString(36).padStart(9, '0');
  const r = crypto.getRandomValues(new Uint8Array(6));
  const rand = [...r].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
  return `${prefix}${t}-${rand}`;
}

export function newMid(): string {
  return `m-${newId()}`;
}
