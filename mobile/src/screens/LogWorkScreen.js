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

function formatTime(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function LogWorkScreen() {
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manualHours, setManualHours] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  const loadToday = useCallback(async () => {
    setLoading(true);
    try {
      const { log: todayLog } = await api.today();
      setLog(todayLog);
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
      const { log: updated } = await api.clockIn();
      setLog(updated);
    } catch (e) {
      Alert.alert('Clock in failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleClockOut() {
    setBusy(true);
    try {
      const { log: updated } = await api.clockOut();
      setLog(updated);
    } catch (e) {
      Alert.alert('Clock out failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleManualSave() {
    const hours = Number(manualHours);
    if (!manualHours || Number.isNaN(hours) || hours < 0 || hours > 24) {
      Alert.alert('Enter a valid number of hours (0-24).');
      return;
    }
    setBusy(true);
    try {
      const today = localDateStr();
      const { log: updated } = await api.manualEntry(today, hours, manualNotes);
      setLog(updated);
      setManualHours('');
      setManualNotes('');
      Alert.alert('Saved', `Logged ${hours}h for today.`);
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setBusy(false);
    }
  }

  const isClockedIn = log && log.clock_in && !log.clock_out;
  const isDone = log && log.clock_in && log.clock_out;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing(5) }}>
      <Text style={styles.title}>Today</Text>
      <Text style={styles.date}>
        {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
      </Text>

      <View style={styles.statusCard}>
        {loading ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Clock in</Text>
              <Text style={styles.statusValue}>{formatTime(log?.clock_in)}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Clock out</Text>
              <Text style={styles.statusValue}>{formatTime(log?.clock_out)}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Hours today</Text>
              <Text style={[styles.statusValue, styles.hoursValue]}>{log?.hours ?? '—'}</Text>
            </View>
          </>
        )}
      </View>

      {!isDone && (
        <TouchableOpacity
          style={[styles.bigButton, isClockedIn ? styles.bigButtonStop : styles.bigButtonStart]}
          onPress={isClockedIn ? handleClockOut : handleClockIn}
          disabled={busy || loading}
        >
          {busy ? (
            <ActivityIndicator color={colors.paper} />
          ) : (
            <Text style={styles.bigButtonText}>{isClockedIn ? 'Clock Out' : 'Clock In'}</Text>
          )}
        </TouchableOpacity>
      )}
      {isDone && <Text style={styles.doneNote}>You've clocked out for today. Nice work.</Text>}

      <Text style={styles.sectionTitle}>Log hours manually</Text>
      <Text style={styles.sectionHint}>
        Forgot to clock in, or worked offline? Enter today's total hours directly.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Hours (e.g. 7.5)"
        keyboardType="decimal-pad"
        value={manualHours}
        onChangeText={setManualHours}
      />
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Notes (optional)"
        multiline
        value={manualNotes}
        onChangeText={setManualNotes}
      />
      <TouchableOpacity style={styles.saveButton} onPress={handleManualSave} disabled={busy}>
        <Text style={styles.saveButtonText}>Save manual entry</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink },
  date: { fontSize: 15, color: colors.textMuted, marginBottom: spacing(4) },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginBottom: spacing(5),
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing(2) },
  statusLabel: { color: colors.textMuted, fontSize: 14 },
  statusValue: { fontSize: 14, fontWeight: '600', color: colors.textDark },
  hoursValue: { color: colors.teal },
  bigButton: { borderRadius: radius.lg, paddingVertical: spacing(5), alignItems: 'center', marginBottom: spacing(3) },
  bigButtonStart: { backgroundColor: colors.teal },
  bigButtonStop: { backgroundColor: colors.rose },
  bigButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  doneNote: { textAlign: 'center', color: colors.textMuted, marginBottom: spacing(3) },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: spacing(6) },
  sectionHint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing(3) },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    marginBottom: spacing(3),
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: colors.amber,
    borderRadius: radius.md,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
    marginBottom: spacing(8),
  },
  saveButtonText: { color: colors.ink, fontWeight: '700', fontSize: 15 },
});
