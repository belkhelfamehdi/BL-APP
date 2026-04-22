import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  loading: boolean;
  error: string | null;
  onLogin: (username: string, password: string) => Promise<void>;
}

const quickUsers = [
  { label: 'Responsable', username: 'responsable.bl', password: 'RespBL123!' },
  { label: 'Preparateur', username: 'preparateur.cmd', password: 'PrepCMD123!' },
  { label: 'Admin', username: 'admin.bl', password: 'AdminBL123!' },
];

export function LoginScreen({ loading, error, onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = useMemo(
    () => username.trim().length > 0 && password.trim().length > 0 && !loading,
    [loading, password, username]
  );

  const submit = async () => {
    if (!canSubmit) {
      return;
    }

    await onLogin(username.trim(), password);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>BL Mobile</Text>
          <Text style={styles.subtitle}>Connexion et operations par role</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Connexion</Text>

          <Text style={styles.label}>Nom utilisateur</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="responsable.bl"
            placeholderTextColor="#8b97a8"
          />

          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Votre mot de passe"
            placeholderTextColor="#8b97a8"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable style={[styles.primaryButton, !canSubmit && styles.disabled]} onPress={submit}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>Se connecter</Text>}
          </Pressable>
        </View>

        <View style={styles.quickCard}>
          <Text style={styles.sectionTitle}>Acces rapide (demo)</Text>
          <View style={styles.quickRow}>
            {quickUsers.map((user) => (
              <Pressable
                key={user.username}
                style={styles.quickButton}
                onPress={() => {
                  setUsername(user.username);
                  setPassword(user.password);
                }}>
                <Text style={styles.quickText}>{user.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
    justifyContent: 'center',
  },
  headerCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#d1d5db',
    marginTop: 4,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 8,
  },
  quickCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 15,
  },
  label: {
    color: '#111827',
    fontWeight: '700',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    color: '#111827',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickButton: {
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickText: {
    color: '#1e40af',
    fontWeight: '700',
  },
});
