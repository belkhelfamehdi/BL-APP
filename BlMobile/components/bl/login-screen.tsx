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

import { LogoMark } from '@/components/brand/logo-mark';
import { Brand, BrandFonts } from '@/constants/brand';

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
        <View pointerEvents="none" style={styles.bgOrbTop} />
        <View pointerEvents="none" style={styles.bgOrbBottom} />

        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <View style={styles.logoFrame}>
              <LogoMark  fill />
            </View>
          </View>

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
    backgroundColor: Brand.bone,
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
    justifyContent: 'center',
  },
  bgOrbTop: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(243, 107, 28, 0.18)',
  },
  bgOrbBottom: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 11, 8, 0.12)',
  },
  formHeader: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  logoFrame: {
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
    aspectRatio: 5,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: '#fff7f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  title: {
    color: Brand.ink,
    fontSize: 28,
    fontWeight: '800',
    fontFamily: BrandFonts.title,
    letterSpacing: 0.6,
    marginTop: 4,
  },
  subtitle: {
    color: Brand.emberDark,
    marginTop: 2,
    fontWeight: '600',
    fontFamily: BrandFonts.body,
  },
  formNote: {
    marginTop: 6,
    color: Brand.muted,
    fontWeight: '600',
    fontFamily: BrandFonts.body,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: Brand.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: 14,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  quickCard: {
    backgroundColor: Brand.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: Brand.ink,
    fontWeight: '800',
    fontSize: 16,
    fontFamily: BrandFonts.title,
    letterSpacing: 0.3,
  },
  label: {
    color: Brand.inkSoft,
    fontWeight: '700',
    fontFamily: BrandFonts.body,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: '#fffaf6',
    color: Brand.ink,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: BrandFonts.body,
  },
  errorText: {
    color: Brand.danger,
    fontWeight: '700',
    fontFamily: BrandFonts.body,
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: Brand.ember,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: Brand.ink,
    fontWeight: '800',
    fontSize: 16,
    fontFamily: BrandFonts.body,
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
    borderColor: Brand.emberGlow,
    backgroundColor: '#fff3ea',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickText: {
    color: Brand.emberDark,
    fontWeight: '700',
    fontFamily: BrandFonts.body,
  },
});
