import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import { localDateStr } from '../utils/date';
import { formatHM } from '../utils/format';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function pad(n) {
  return String(n).padStart(2, '0');
}

// Builds a 7-wide grid of cells for the given month, including leading/trailing
// blanks so weeks line up under the weekday header.
function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // getDay(): 0=Sun..6=Sat -> convert to Mon-first index (0=Mon..6=Sun)
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// logsByDate: { 'YYYY-MM-DD': { totalHours, entries: [...] } }
export default function CalendarGrid({ year, month, logsByDate, onDayPress, selectedDate }) {
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const todayStr = localDateStr();

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, idx) => {
          if (day === null) return <View key={`b${idx}`} style={styles.cell} />;

          const dateStr = `${year}-${pad(month)}-${pad(day)}`;
          const dayData = logsByDate[dateStr];
          const hasHours = dayData && dayData.totalHours > 0;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;

          return (
            <TouchableOpacity
              key={dateStr}
              style={[
                styles.cell,
                hasHours && styles.cellFilled,
                isToday && styles.cellToday,
                isSelected && styles.cellSelected,
              ]}
              onPress={() => onDayPress && onDayPress(dateStr, dayData)}
            >
              <Text style={[styles.dayNum, hasHours && styles.dayNumFilled]}>{day}</Text>
              {hasHours ? <Text style={styles.hoursLabel}>{formatHM(dayData.totalHours, { compact: true })}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    marginBottom: 4,
  },
  cellFilled: { backgroundColor: colors.amberSoft },
  cellToday: { borderWidth: 2, borderColor: colors.teal },
  cellSelected: { borderWidth: 2, borderColor: colors.ink },
  dayNum: { fontSize: 14, color: colors.textDark, fontWeight: '500' },
  dayNumFilled: { fontWeight: '700' },
  hoursLabel: { fontSize: 10, color: colors.teal, fontWeight: '600' },
});