export function sqliteBoolean(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  throw new TypeError(`Invalid SQLite boolean value: ${String(value)}`);
}

export function sqliteTimestamp(value) {
  const date = value instanceof Date
    ? new Date(value.getTime())
    : typeof value === "number"
      ? new Date(value * 1_000)
      : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new TypeError(`Invalid SQLite timestamp value: ${String(value)}`);
  return date;
}

export function parseSqliteJson(value, columnName) {
  try {
    return JSON.parse(String(value));
  } catch {
    throw new TypeError(`Invalid JSON in SQLite column ${columnName}`);
  }
}

export function postgresJson(value) {
  return JSON.stringify(value);
}
