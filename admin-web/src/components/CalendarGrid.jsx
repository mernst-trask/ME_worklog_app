import React, { useMemo } from 'react';
import { localDateStr } from '../utils/date';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function pad(n) {
  return String(n).padStart(2, '0');
}

function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarGrid({ year, month, logsByDate, selectedDate, onDayPress }) {
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const todayStr = localDateStr();

  return (
    <div>
      <div className="calendar-grid" style={{ marginBottom: 4 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="weekday-label">{w}</div>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`b${idx}`} className="day-cell empty" />;

          const dateStr = `${year}-${pad(month)}-${pad(day)}`;
          const dayData = logsByDate[dateStr];
          const hasHours = dayData && dayData.totalHours > 0;
          const classes = ['day-cell'];
          if (hasHours) classes.push('filled');
          if (dateStr === todayStr) classes.push('today');
          if (dateStr === selectedDate) classes.push('selected');

          return (
            <div
              key={dateStr}
              className={classes.join(' ')}
              onClick={() => onDayPress && onDayPress(dateStr, dayData)}
            >
              <span className="day-num">{day}</span>
              {hasHours ? <span className="day-hours">{dayData.totalHours}h</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}