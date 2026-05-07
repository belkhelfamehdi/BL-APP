import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Brand } from '@/constants/brand';
import { LogoMark } from '@/components/brand/logo-mark';

interface Props {
  loading: boolean;
  error: string | null;
  onLogin: (username: string, password: string) => Promise<void>;
}

const quickUsers = [
  { label: 'Responsable', username: 'responsable.bl', password: 'RespBL123!' },
  { label: 'Préparateur', username: 'preparateur.cmd', password: 'PrepCMD123!' },
  { label: 'Admin', username: 'admin.bl', password: 'AdminBL123!' },
];

export function LoginScreen({ loading, error, onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => username.trim().length > 0 && password.trim().length > 0 && !loading,
    [loading, password, username]
  );

  const submit = async () => {
    if (!canSubmit) return;
    await onLogin(username.trim(), password);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ── Dark top: logo ── */}
      <SafeAreaView style={styles.topSection} edges={['top', 'left', 'right']}>
        <View style={styles.logoArea}>
          <LogoMark size={180} />
        </View>
      </SafeAreaView>

      {/* ── White bottom sheet: form ── */}
      <KeyboardAvoidingView
        style={styles.bottomSection}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.flex} edges={['bottom', 'left', 'right']}>
          <ScrollView
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            <Text style={styles.formTitle}>Connexion</Text>
            <Text style={styles.formSubtitle}>Accédez à votre espace de travail</Text>

            <View style={styles.fields}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Identifiant</Text>
                <View style={[styles.inputWrap, focusedField === 'user' && styles.inputWrapFocused]}>
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="nom.utilisateur"
                    placeholderTextColor="#C0C0C0"
                    onFocus={() => setFocusedField('user')}
                    onBlur={() => setFocusedField(null)}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mot de passe</Text>
                <View style={[styles.inputWrap, focusedField === 'pass' && styles.inputWrapFocused]}>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor="#C0C0C0"
                    onFocus={() => setFocusedField('pass')}
                    onBlur={() => setFocusedField(null)}
                    returnKeyType="done"
                    onSubmitEditing={submit}
                  />
                </View>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                !canSubmit && styles.submitBtnDisabled,
                pressed && canSubmit && styles.submitBtnPressed,
              ]}
              onPress={submit}
              disabled={!canSubmit}>
              <Text style={styles.submitBtnText}>
                {loading ? 'Connexion…' : 'Se connecter'}
              </Text>
            </Pressable>

            <View style={styles.demoSection}>
              <Text style={styles.demoLabel}>Accès démo</Text>
              <View style={styles.demoRow}>
                {quickUsers.map((u) => (
                  <Pressable
                    key={u.username}
                    style={({ pressed }) => [styles.demoChip, pressed && { opacity: 0.65 }]}
                    onPress={() => { setUsername(u.username); setPassword(u.password); }}>
                    <Text style={styles.demoChipText}>{u.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.ink,
  },
  flex: { flex: 1 },

  topSection: {
    backgroundColor: Brand.ink,
  },
  logoArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 32,
  },

  bottomSection: {
    flex: 1,
    backgroundColor: '#F7F7F7',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 20,
  },
  formContent: {
    padding: 28,
    paddingTop: 32,
    flexGrow: 1,
  },

  formTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Brand.ink,
    letterSpacing: -0.5,
  },
  formSubtitle: {
    fontSize: 15,
    color: Brand.muted,
    marginTop: 6,
    marginBottom: 28,
  },

  fields: {
    gap: 16,
    marginBottom: 16,
  },
  fieldGroup: {
    gap: 7,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.ink,
    letterSpacing: 0.2,
  },
  inputWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  inputWrapFocused: {
    borderColor: Brand.ember,
    shadowColor: Brand.ember,
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: Brand.ink,
  },

  errorBox: {
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD0D0',
    padding: 13,
    marginBottom: 12,
  },
  errorText: {
    color: Brand.danger,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  submitBtn: {
    backgroundColor: Brand.ember,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: Brand.ember,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnDisabled: {
    backgroundColor: '#D0D0D0',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  demoSection: {
    marginTop: 28,
    alignItems: 'center',
    gap: 12,
  },
  demoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#BBBBBB',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  demoRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  demoChip: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  demoChipText: {
    fontSize: 13,
    color: Brand.ink,
    fontWeight: '500',
  },
});
