import React, { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Brand } from '@/constants/brand';
import { parseLocalIso, toLocalIso } from '@/utils/date';

interface Props {
  visible: boolean;
  title: string;
  value: string;
  onConfirm: (next: string) => void;
  onCancel: () => void;
}

export function DatePickerModal({ visible, title, value, onConfirm, onCancel }: Props) {
  const [pending, setPending] = useState<string>(value);

  const onChange = useCallback((event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (event?.type === 'set' && selectedDate) onConfirm(toLocalIso(selectedDate));
      else onCancel();
      return;
    }
    if (selectedDate) setPending(toLocalIso(selectedDate));
  }, [onCancel, onConfirm]);

  if (Platform.OS !== 'ios') {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={parseLocalIso(value)}
        mode="date"
        display="default"
        onChange={onChange}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={() => setPending(value)}
      onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
              onPress={onCancel}>
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.7 }]}
              onPress={() => onConfirm(pending)}>
              <Text style={styles.doneText}>Confirmer</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={parseLocalIso(pending)}
            mode="date"
            display="spinner"
            onChange={onChange}
            locale="fr-FR"
            themeVariant="light"
            style={styles.control}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  title: { fontSize: 15, fontWeight: '600', color: Brand.ink },
  cancelBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  cancelText: { color: Brand.muted, fontSize: 14, fontWeight: '500' },
  doneBtn: { backgroundColor: Brand.ember, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  doneText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  control: { width: '100%' },
});
