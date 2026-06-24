// Returns 'YYYY-MM-DD' for the LOCAL date, not UTC.
// `date.toISOString().slice(0,10)` converts to UTC first, which silently
// shifts the date back by one day for any timezone ahead of UTC
// (e.g. Central Europe, most of Asia) - this matters a lot for date pickers
// and month-end calculations, not just near midnight.
export function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
