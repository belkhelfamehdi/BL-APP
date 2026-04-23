import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import { LogoMark } from '@/components/brand/logo-mark';

interface Props {
  loading: boolean;
  error: string | null;
  onLogin: (username: string, password: string) => Promise<void>;
}

const quickUsers = [
  { label: 'Responsable', username: 'responsable.bl', password: 'RespBL123!' },
  { label: 'Prep', username: 'preparateur.cmd', password: 'PrepCMD123!' },
  { label: 'Admin', username: 'admin.bl', password: 'AdminBL123!' },
];

export function LoginScreen({ loading, error, onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => username.trim().length > 0 && password.trim().length > 0 && !loading,
    [loading, password, username]
  );

  const submit = async () => {
    if (!canSubmit) return;
    await onLogin(username.trim(), password);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <LogoMark size={240} />
          </View>

          <View style={styles.form}>
            <View style={[styles.inputContainer, focused === 'username' && styles.inputFocused]}>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Utilisateur"
                placeholderTextColor={Brand.muted}
                onFocus={() => setFocused('username')}
                onBlur={() => setFocused(null)}
              />
            </View>

            <View style={[styles.inputContainer, focused === 'password' && styles.inputFocused]}>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Mot de passe"
                placeholderTextColor={Brand.muted}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
              />
            </View>

            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}

            <Pressable
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={submit}
              disabled={!canSubmit}>
              <Text style={styles.buttonText}>
                {loading ? 'Connexion...' : 'Se connecter'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.quickAccess}>
            <Text style={styles.quickLabel}>Demo</Text>
            <View style={styles.quickButtons}>
              {quickUsers.map((user) => (
                <Pressable
                  key={user.username}
                  style={styles.quickButton}
                  onPress={() => {
                    setUsername(user.username);
                    setPassword(user.password);
                  }}>
                  <Text style={styles.quickButtonText}>{user.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: Brand.ink,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Brand.muted,
    marginTop: 4,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputFocused: {
    backgroundColor: '#fff',
    borderColor: Brand.ink,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: Brand.ink,
  },
  error: {
    color: Brand.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Brand.ink,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  quickAccess: {
    marginTop: 40,
    alignItems: 'center',
  },
  quickLabel: {
    fontSize: 11,
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  quickButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  quickButtonText: {
    fontSize: 13,
    color: Brand.ink,
    fontWeight: '500',
  },
});