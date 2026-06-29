// Tiny CSV writer - no dependency needed for a handful of columns.
//
// Two deliberate choices here for European/Czech locale Excel:
// - Semicolon delimiter: in Czech (and most EU) locales, Excel's default
//   list separator is ";" because "," is the decimal point. Opening a
//   comma-delimited CSV by double-click then dumps every field into a
//   single unsplit column - which looks like data is "missing".
// - UTF-8 BOM (added by the caller, see reports.js): without it, Excel
//   guesses the file's encoding from the system codepage instead of UTF-8,
//   garbling accented characters (č, ř, š, ě, ...).
const DELIMITER = ';';

function toCsv(rows, columns) {
  const escape = (val) => {
    const s = val === null || val === undefined ? '' : String(val);
    return new RegExp(`["${DELIMITER}\\n]`).test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = columns.map((c) => escape(c.label)).join(DELIMITER);
  const body = rows
    .map((row) => columns.map((c) => escape(row[c.key])).join(DELIMITER))
    .join('\n');

  return `${header}\n${body}`;
}

module.exports = { toCsv };