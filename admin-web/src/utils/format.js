// Formats decimal hours as "Xh Ym" for display (e.g. 0.93 -> "56m", 2.5 -> "2h 30m").
// Inputs (typing hours into a field) stay as decimal hours - this is only for
// showing totals/remaining time, where "0.93h" reads strangely but "56m" doesn't.
export function formatHM(decimalHours, { compact = false } = {}) {
  const totalMinutes = Math.round((decimalHours || 0) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const sep = compact ? '' : ' ';
  if (h === 0 && m === 0) return '0h';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${sep}${m}m`;
}