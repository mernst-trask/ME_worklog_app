// Returns 'YYYY-MM-DD' for the device's LOCAL date.
// Deliberately avoids `date.toISOString().slice(0,10)`, which converts to UTC
// first and silently shifts the date by one day for any timezone ahead of UTC
// (e.g. Central Europe, most of Asia) - especially right after local midnight.
export function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
