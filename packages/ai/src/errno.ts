/**
 * True when `err` is a Node system error carrying the given `code`
 * (e.g. "EISDIR", "ENOENT"). Node throws these as plain `Error`s with a `code`
 * property; the file tools translate the common ones into messages that tell the
 * model what to do instead of surfacing a raw errno.
 */
export function hasErrorCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" && err !== null && "code" in err && err.code === code
  );
}
