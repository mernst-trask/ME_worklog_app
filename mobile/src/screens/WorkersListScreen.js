import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, radius, spacing } from '../theme';

export default function WorkersListScreen({ navigation }) {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { workers: list } = await api.workers();
      setWorkers(list);
    } catch (e) {
      Alert.alert('Could not load workers', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleAddWorker() {
    if (!form.name || !form.email || !form.password) {
      Alert.alert('Fill in name, email and a password.');
      return;
    }
    setSaving(true);
    try {
      await api.addWorker(form.name.trim(), form.email.trim(), form.password);
      setForm({ name: '', email: '', password: '' });
      setModalVisible(false);
      load();
    } catch (e) {
      Alert.alert('Could not add worker', e.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove(worker) {
    Alert.alert('Remove worker', `Remove ${worker.name} and all their logged hours?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.removeWorker(worker.id);
            load();
          } catch (e) {
            Alert.alert('Could not remove worker', e.message);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Team</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Text style={styles.addButtonText}>+ Add worker</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.ink} style={{ marginTop: spacing(8) }} />
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(w) => String(w.id)}
          contentContainerStyle={{ paddingBottom: spacing(8) }}
          ListEmptyComponent={<Text style={styles.empty}>No workers yet. Add your first one above.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.workerRow}
              onPress={() => navigation.navigate('WorkerDetail', { userId: item.id, name: item.name })}
              onLongPress={() => confirmRemove(item)}
            >
              <View>
                <Text style={styles.workerName}>{item.name}</Text>
                <Text style={styles.workerEmail}>{item.email}</Text>
              </View>
              <Text style={styles.workerHours}>{item.hoursThisMonth.toFixed(1)}h</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add worker</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              value={form.name}
              onChangeText={(name) => setForm((f) => ({ ...f, name }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={form.email}
              onChangeText={(email) => setForm((f) => ({ ...f, email }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Temporary password"
              secureTextEntry
              value={form.password}
              onChangeText={(password) => setForm((f) => ({ ...f, password }))}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleAddWorker} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing(5) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing(4) },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  addButton: { backgroundColor: colors.ink, borderRadius: radius.md, paddingHorizontal: spacing(3), paddingVertical: spacing(2) },
  addButtonText: { color: colors.paper, fontWeight: '700', fontSize: 13 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing(8) },
  workerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(4),
    marginBottom: spacing(3),
  },
  workerName: { fontWeight: '700', color: colors.textDark, fontSize: 15 },
  workerEmail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  workerHours: { color: colors.teal, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing(5) },
  modalCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing(5) },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: spacing(4) },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
    marginBottom: spacing(3),
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing(3) },
  cancelButton: { paddingVertical: spacing(2.5), paddingHorizontal: spacing(4) },
  cancelButtonText: { color: colors.textMuted, fontWeight: '600' },
  saveButton: { backgroundColor: colors.teal, borderRadius: radius.md, paddingVertical: spacing(2.5), paddingHorizontal: spacing(5) },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
