import React, { useCallback, useState } from 'react';
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
import { api } from '../api';
import { colors, radius, spacing } from '../theme';
import { localDateStr } from '../utils/date';
import { formatHM } from '../utils/format';

function formatTime(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function LogWorkScreen() {
  const [entries, setEntries] = useState([]);
  const [activeEntry, setActiveEntry] = useState(null);
  const [totalHours, setTotalHours] = useState(0);
  const [dailyCap, setDailyCap] = useState(10);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [addHours, setAddHours] = useState('');
  const [addNotes, setAddNotes] = useState('');

  const loadToday = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.today();
      setEntries(data.entries);
      setActiveEntry(data.activeEntry);
      setTotalHours(data.totalHours);
      setDailyCap(data.dailyCap);
    } catch (e) {
      Alert.alert('Could not load today', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadToday();
    }, [loadToday])
  );

  async function handleClockIn() {
    setBusy(true);
    try {
      await api.clockIn();
      await loadToday();
    } catch (e) {
      Alert.alert('Clock in failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleClockOut() {
    setBusy(true);
    try {
      const { capped, rawHours } = await api.clockOut();
      await loadToday();
      if (capped) {
        Alert.alert(
          'Daily limit reached',
          `That session was ${formatHM(rawHours)}, but only part of it counted - you're capped at ${dailyCap}h logged per day.`
        );
      }
    } catch (e) {
      Alert.alert('Clock out failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddActivity() {
    const hours = Number(addHours);
    if (!addHours || Number.isNaN(hours) || hours <= 0 || hours > 24) {
      Alert.alert('Enter a valid number of hours.');
      return;
    }
    setBusy(true);
    try {
      await api.addActivity(localDateStr(), hours, addNotes);
      setAddHours('');
      setAddNotes('');
      await loadToday();
    } catch (e) {
      Alert.alert('Could not add activity', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(entry) {
    Alert.alert('Delete entry', 'Remove this activity from today?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteEntry(entry.id);
            await loadToday();
          } catch (e) {
            Alert.alert('Could not delete', e.message);
          }
        },
      },
    ]);
  }

  const remaining = Math.max(0, dailyCap - totalHours);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing(5) }}>
      <Text style={styles.title}>Today</Text>
      <Text style={styles.date}>
        {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
      </Text>

      <View style={styles.totalsCard}>
        <View>
          <Text style={styles.totalsValue}>{formatHM(totalHours)}</Text>
          <Text style={styles.totalsLabel}>logged today</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.totalsValueMuted}>{formatHM(remaining)}</Text>
          <Text style={styles.totalsLabel}>remaining of {dailyCap}h cap</Text>
        </View>
      </View>

      {!activeEntry ? (
        <TouchableOpacity style={[styles.bigButton, styles.bigButtonStart]} onPress={handleClockIn} disabled={busy || loading}>
          {busy ? <ActivityIndicator color={colors.paper} /> : <Text style={styles.bigButtonText}>Clock In</Text>}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.bigButton, styles.bigButtonStop]} onPress={handleClockOut} disabled={busy || loading}>
          {busy ? (
            <ActivityIndicator color={colors.paper} />
          ) : (
            <Text style={styles.bigButtonText}>Clock Out (in since {formatTime(activeEntry.clock_in)})</Text>
          )}
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Today's activities</Text>
      {loading ? (
        <ActivityIndicator color={colors.ink} style={{ marginVertical: spacing(4) }} />
      ) : entries.length === 0 ? (
        <Text style={styles.emptyNote}>Nothing logged yet today.</Text>
      ) : (
        entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} onChanged={loadToday} onDelete={() => handleDelete(entry)} />
        ))
      )}

      <Text style={styles.sectionTitle}>Add another activity</Text>
      <Text style={styles.sectionHint}>
        For work that wasn't tracked with Clock In - e.g. a second shift, or offline work.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Hours (e.g. 2.5)"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        value={addHours}
        onChangeText={setAddHours}
      />
      <TextInput
        style={[styles.input, { height: 70 }]}
        placeholder="What did you work on? (optional)"
        placeholderTextColor={colors.textMuted}
        multiline
        value={addNotes}
        onChangeText={setAddNotes}
      />
      <TouchableOpacity style={styles.saveButton} onPress={handleAddActivity} disabled={busy}>
        <Text style={styles.saveButtonText}>Add activity</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function EntryRow({ entry, onChanged, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState(String(entry.hours ?? ''));
  const [notes, setNotes] = useState(entry.notes || '');
  const [saving, setSaving] = useState(false);

  const isClocked = !!entry.clock_in;
  const isOpen = isClocked && !entry.clock_out;

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

  if (isOpen) {
    return (
      <View style={styles.entryRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.entryTitle}>In progress</Text>
          <Text style={styles.entryMeta}>Clocked in at {formatTime(entry.clock_in)}</Text>
        </View>
        <TouchableOpacity onPress={onDelete}>
          <Text style={styles.deleteLink}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (editing) {
    return (
      <View style={styles.entryRowEditing}>
        <TextInput
          style={styles.input}
          placeholder="Hours"
          keyboardType="decimal-pad"
          value={hours}
          onChangeText={setHours}
        />
        <TextInput
          style={[styles.input, { height: 60 }]}
          placeholder="Notes"
          multiline
          value={notes}
          onChangeText={setNotes}
        />
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
    <TouchableOpacity style={styles.entryRow} onPress={() => setEditing(true)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.entryTitle}>
          {isClocked ? `${formatTime(entry.clock_in)} – ${formatTime(entry.clock_out)}` : 'Manual entry'}
        </Text>
        {entry.notes ? <Text style={styles.entryMeta}>{entry.notes}</Text> : null}
      </View>
      <Text style={styles.entryHours}>{formatHM(entry.hours)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink },
  date: { fontSize: 15, color: colors.textMuted, marginBottom: spacing(4) },
  totalsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginBottom: spacing(4),
  },
  totalsValue: { fontSize: 22, fontWeight: '800', color: colors.teal },
  totalsValueMuted: { fontSize: 22, fontWeight: '800', color: colors.textMuted },
  totalsLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  bigButton: { borderRadius: radius.lg, paddingVertical: spacing(5), alignItems: 'center', marginBottom: spacing(5) },
  bigButtonStart: { backgroundColor: colors.teal },
  bigButtonStop: { backgroundColor: colors.rose },
  bigButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center', paddingHorizontal: spacing(3) },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: spacing(3) },
  sectionHint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing(3) },
  emptyNote: { color: colors.textMuted, fontSize: 14, marginVertical: spacing(3) },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3.5),
    marginTop: spacing(2.5),
  },
  entryRowEditing: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radius.md,
    padding: spacing(3.5),
    marginTop: spacing(2.5),
  },
  entryTitle: { fontWeight: '700', color: colors.textDark, fontSize: 14 },
  entryMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  entryHours: { color: colors.teal, fontWeight: '800', fontSize: 15 },
  deleteLink: { color: colors.rose, fontWeight: '600', fontSize: 13 },
  input: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    marginBottom: spacing(2.5),
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: colors.amber,
    borderRadius: radius.md,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
    marginBottom: spacing(8),
  },
  saveButtonText: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  smallButton: { flex: 1, backgroundColor: colors.teal, borderRadius: radius.sm, paddingVertical: spacing(2.5), alignItems: 'center' },
  smallButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  smallButtonSecondary: { flex: 1, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: spacing(2.5), alignItems: 'center' },
  smallButtonSecondaryText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
});