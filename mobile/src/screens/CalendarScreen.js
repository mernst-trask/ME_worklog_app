import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import CalendarGrid from '../components/CalendarGrid';
import { api } from '../api';
import { colors, radius, spacing } from '../theme';
import { formatHM } from '../utils/format';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatTime(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// `userId` is only passed when a MANAGER is looking at a worker's calendar.
// In that case the view is read-only - editing always saves to the logged-in
// user's own account on the backend, so it must never be offered here for
// someone else's data.
export default function CalendarScreen({ userId, title }) {
  const canEdit = !userId;
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [logs, setLogs] = useState([]);
  const [dailyCap, setDailyCap] = useState(10);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.monthLogs(year, month, userId);
      setLogs(data.logs);
      setDailyCap(data.dailyCap || 10);
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

  // Group the flat list of entries into { date: { totalHours, entries } }
  const logsByDate = useMemo(() => {
    const map = {};
    logs.forEach((entry) => {
      if (!map[entry.work_date]) map[entry.work_date] = { totalHours: 0, entries: [] };
      map[entry.work_date].entries.push(entry);
      map[entry.work_date].totalHours += entry.hours || 0;
    });
    Object.values(map).forEach((d) => {
      d.totalHours = Math.round(d.totalHours * 100) / 100;
    });
    return map;
  }, [logs]);

  const monthTotal = useMemo(
    () => Object.values(logsByDate).reduce((sum, d) => sum + d.totalHours, 0),
    [logsByDate]
  );
  const daysLogged = Object.keys(logsByDate).length;

  const selectedDay = selectedDate ? logsByDate[selectedDate] || { totalHours: 0, entries: [] } : null;

  function shiftMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
    setSelectedDate(null);
  }

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
            selectedDate={selectedDate}
            onDayPress={(dateStr) => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
          />

          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryValue}>{formatHM(monthTotal)}</Text>
              <Text style={styles.summaryLabel}>total this month</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.summaryValue}>{daysLogged}</Text>
              <Text style={styles.summaryLabel}>days logged</Text>
            </View>
          </View>

          {selectedDate && (
            <DayDetail
              date={selectedDate}
              day={selectedDay}
              dailyCap={dailyCap}
              canEdit={canEdit}
              onChanged={load}
            />
          )}
        </>
      )}
      <View style={{ height: spacing(10) }} />
    </ScrollView>
  );
}

function DayDetail({ date, day, dailyCap, canEdit, onChanged }) {
  const [addingNew, setAddingNew] = useState(false);
  const remaining = Math.max(0, dailyCap - day.totalHours);

  return (
    <View style={styles.dayCard}>
      <View style={styles.dayHeaderRow}>
        <Text style={styles.dayHeaderDate}>{date}</Text>
        <Text style={styles.dayHeaderTotal}>
          {formatHM(day.totalHours)} / {dailyCap}h
        </Text>
      </View>

      {day.entries.length === 0 ? (
        <Text style={styles.emptyNote}>No hours logged this day.</Text>
      ) : (
        day.entries.map((entry) => (
          <DayEntryRow key={entry.id} entry={entry} canEdit={canEdit} onChanged={onChanged} />
        ))
      )}

      {canEdit && (
        addingNew ? (
          <AddActivityForm
            date={date}
            remaining={remaining}
            onDone={() => { setAddingNew(false); onChanged(); }}
            onCancel={() => setAddingNew(false)}
          />
        ) : (
          remaining > 0 ? (
            <TouchableOpacity style={styles.addLink} onPress={() => setAddingNew(true)}>
              <Text style={styles.addLinkText}>+ Add activity ({formatHM(remaining)} left)</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.cappedNote}>Daily limit reached for this day.</Text>
          )
        )
      )}
    </View>
  );
}

function DayEntryRow({ entry, canEdit, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState(String(entry.hours ?? ''));
  const [notes, setNotes] = useState(entry.notes || '');
  const [saving, setSaving] = useState(false);
  const isOpen = entry.clock_in && !entry.clock_out;

  async function handleSave() {
    const numHours = Number(hours);
    if (!hours || Number.isNaN(numHours) || numHours <= 0 || numHours > 24) {
      Alert.alert('Enter a valid number of hours.');
      return;
    }
    setSaving(true);
    try {
      await api.editEntry(entry.id, numHours, notes);
      setEditing(false);
      onChanged();
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    Alert.alert('Delete entry', 'Remove this activity?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteEntry(entry.id);
            onChanged();
          } catch (e) {
            Alert.alert('Could not delete', e.message);
          }
        },
      },
    ]);
  }

  if (editing) {
    return (
      <View style={styles.entryEditing}>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={hours} onChangeText={setHours} placeholder="Hours" />
        <TextInput style={[styles.input, { height: 60 }]} value={notes} onChangeText={setNotes} placeholder="Notes" multiline />
        <View style={{ flexDirection: 'row', gap: spacing(2) }}>
          <TouchableOpacity style={styles.smallButtonSecondary} onPress={() => setEditing(false)}>
            <Text style={styles.smallButtonSecondaryText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.smallButtonText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.entryRow}
      onPress={() => canEdit && !isOpen && setEditing(true)}
      disabled={!canEdit || isOpen}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.entryTitle}>
          {isOpen
            ? `In progress (since ${formatTime(entry.clock_in)})`
            : entry.clock_in
            ? `${formatTime(entry.clock_in)} – ${formatTime(entry.clock_out)}`
            : 'Manual entry'}
        </Text>
        {entry.notes ? <Text style={styles.entryMeta}>{entry.notes}</Text> : null}
      </View>
      {!isOpen && <Text style={styles.entryHours}>{formatHM(entry.hours)}</Text>}
      {canEdit && (
        <TouchableOpacity onPress={handleDelete} style={{ marginLeft: spacing(3) }}>
          <Text style={styles.deleteLink}>✕</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function AddActivityForm({ date, remaining, onDone, onCancel }) {
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const numHours = Number(hours);
    if (!hours || Number.isNaN(numHours) || numHours <= 0 || numHours > 24) {
      Alert.alert('Enter a valid number of hours.');
      return;
    }
    setSaving(true);
    try {
      await api.addActivity(date, numHours, notes);
      onDone();
    } catch (e) {
      Alert.alert('Could not add activity', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.entryEditing}>
      <TextInput
        style={styles.input}
        placeholder={`Hours (up to ${remaining.toFixed(2)})`}
        keyboardType="decimal-pad"
        value={hours}
        onChangeText={setHours}
      />
      <TextInput
        style={[styles.input, { height: 60 }]}
        placeholder="What did you work on? (optional)"
        multiline
        value={notes}
        onChangeText={setNotes}
      />
      <View style={{ flexDirection: 'row', gap: spacing(2) }}>
        <TouchableOpacity style={styles.smallButtonSecondary} onPress={onCancel}>
          <Text style={styles.smallButtonSecondaryText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.smallButtonText}>Add</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing(5) },
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
  summaryLabel: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  summaryValue: { color: colors.teal, fontWeight: '800', fontSize: 18 },
  dayCard: {
    backgroundColor: colors.inkSoft,
    borderRadius: radius.md,
    padding: spacing(4),
    marginTop: spacing(3),
  },
  dayHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing(3) },
  dayHeaderDate: { color: colors.paper, fontWeight: '700' },
  dayHeaderTotal: { color: colors.amberSoft, fontWeight: '700', fontSize: 13 },
  emptyNote: { color: colors.amberSoft, fontSize: 13, opacity: 0.8 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.sm,
    padding: spacing(3),
    marginBottom: spacing(2),
  },
  entryEditing: {
    backgroundColor: '#fff',
    borderRadius: radius.sm,
    padding: spacing(3),
    marginBottom: spacing(2),
  },
  entryTitle: { color: colors.paper, fontWeight: '600', fontSize: 13 },
  entryMeta: { color: colors.amberSoft, fontSize: 12, marginTop: 2 },
  entryHours: { color: colors.amber, fontWeight: '800', fontSize: 14 },
  deleteLink: { color: colors.rose, fontWeight: '700', fontSize: 14, paddingHorizontal: 4 },
  input: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    marginBottom: spacing(2.5),
    fontSize: 14,
    color: colors.textDark,
  },
  smallButton: { flex: 1, backgroundColor: colors.teal, borderRadius: radius.sm, paddingVertical: spacing(2.5), alignItems: 'center' },
  smallButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  smallButtonSecondary: { flex: 1, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: spacing(2.5), alignItems: 'center' },
  smallButtonSecondaryText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  addLink: { paddingVertical: spacing(2), alignItems: 'center' },
  addLinkText: { color: colors.amber, fontWeight: '700', fontSize: 13 },
  cappedNote: { color: colors.amberSoft, fontSize: 12, textAlign: 'center', opacity: 0.8, marginTop: spacing(1) },
});