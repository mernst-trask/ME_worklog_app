import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import CalendarGrid from '../components/CalendarGrid';
import { api } from '../api';
import { colors, radius, spacing } from '../theme';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarScreen({ userId, title }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { logs: monthLogs } = await api.monthLogs(year, month, userId);
      setLogs(monthLogs);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, [year, month, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const logsByDate = useMemo(() => {
    const map = {};
    logs.forEach((l) => {
      map[l.work_date] = l;
    });
    return map;
  }, [logs]);

  const totalHours = useMemo(
    () => logs.reduce((sum, l) => sum + (l.hours || 0), 0),
    [logs]
  );

  function shiftMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
    setSelected(null);
  }

  return (
    <View style={styles.container}>
      {title ? <Text style={styles.title}>{title}</Text> : null}

      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.navButton}>
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.navButton}>
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.ink} style={{ marginTop: spacing(8) }} />
      ) : (
        <>
          <CalendarGrid
            year={year}
            month={month}
            logsByDate={logsByDate}
            selectedDate={selected?.work_date}
            onDayPress={(dateStr, log) => setSelected(log ? { ...log, work_date: dateStr } : { work_date: dateStr })}
          />

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total this month</Text>
            <Text style={styles.summaryValue}>{totalHours.toFixed(2)}h</Text>
          </View>

          {selected && (
            <View style={styles.detailCard}>
              <Text style={styles.detailDate}>{selected.work_date}</Text>
              {selected.hours ? (
                <>
                  <Text style={styles.detailLine}>Hours: {selected.hours}</Text>
                  {selected.clock_in ? (
                    <Text style={styles.detailLine}>
                      In: {new Date(selected.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {selected.clock_out
                        ? `  •  Out: ${new Date(selected.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : ''}
                    </Text>
                  ) : null}
                  {selected.notes ? <Text style={styles.detailLine}>Notes: {selected.notes}</Text> : null}
                </>
              ) : (
                <Text style={styles.detailLine}>No hours logged this day.</Text>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing(5) },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: spacing(2) },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing(4) },
  navButton: { paddingHorizontal: spacing(5), paddingVertical: spacing(1) },
  navButtonText: { fontSize: 24, color: colors.ink },
  monthLabel: { fontSize: 17, fontWeight: '700', color: colors.ink, minWidth: 160, textAlign: 'center' },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(4),
    marginTop: spacing(4),
  },
  summaryLabel: { color: colors.textMuted, fontWeight: '600' },
  summaryValue: { color: colors.teal, fontWeight: '800', fontSize: 16 },
  detailCard: {
    backgroundColor: colors.inkSoft,
    borderRadius: radius.md,
    padding: spacing(4),
    marginTop: spacing(3),
  },
  detailDate: { color: colors.paper, fontWeight: '700', marginBottom: spacing(1) },
  detailLine: { color: colors.amberSoft, fontSize: 13, marginTop: 2 },
});
