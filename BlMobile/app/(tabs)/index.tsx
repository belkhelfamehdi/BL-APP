import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminScreen } from '@/components/bl/admin-screen';
import { LoginScreen } from '@/components/bl/login-screen';
import { PreparateurScreen } from '@/components/bl/preparateur-screen';
import { ResponsableScreen } from '@/components/bl/responsable-screen';
import { api } from '@/services/api';
import { User } from '@/types/app';

const roleLabel: Record<User['role'], string> = {
  responsable: 'Responsable des BL',
  preparateur: 'Preparateur',
  admin: 'Admin',
};

export default function HomeScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async (username: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.login(username, password);
      setToken(res.token);
      setUser(res.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    const currentToken = token;
    setToken(null);
    setUser(null);
    setError(null);

    if (!currentToken) {
      return;
    }

    try {
      await api.logout(currentToken);
    } catch {
      // Ignore remote logout failure when local session is cleared.
    }
  };

  const roleScreen = useMemo(() => {
    if (!token || !user) {
      return null;
    }

    if (user.role === 'responsable') {
      return <ResponsableScreen token={token} fullName={user.full_name} />;
    }

    if (user.role === 'preparateur') {
      return <PreparateurScreen token={token} fullName={user.full_name} />;
    }

    return <AdminScreen token={token} fullName={user.full_name} />;
  }, [token, user]);

  if (!token || !user) {
    return <LoginScreen loading={loading} error={error} onLogin={onLogin} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.roleBadge}>{roleLabel[user.role]}</Text>
          <Text style={styles.userText}>{user.full_name}</Text>
        </View>

        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Deconnexion</Text>
        </Pressable>
      </View>

      <View style={styles.body}>{roleScreen}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e6e8ee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f5ff',
    color: '#0b5cab',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: 12,
    fontWeight: '700',
  },
  userText: {
    marginTop: 4,
    color: '#1f2a37',
    fontWeight: '700',
  },
  logoutButton: {
    borderRadius: 10,
    backgroundColor: '#1f2a37',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  body: {
    flex: 1,
  },
});
