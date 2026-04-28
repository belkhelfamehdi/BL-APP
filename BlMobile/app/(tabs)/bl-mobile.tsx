import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminScreen } from '@/components/bl/admin-screen';
import { LoginScreen } from '@/components/bl/login-screen';
import { PreparateurScreen } from '@/components/bl/preparateur-screen';
import { ResponsableScreen } from '@/components/bl/responsable-screen';
import { Brand } from '@/constants/brand';
import { api } from '@/services/api';
import { User } from '@/types/app';

const roleLabel: Record<User['role'], string> = {
  responsable: 'Resp.',
  preparateur: 'Prep.',
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
    if (!currentToken) return;
    try {
      await api.logout(currentToken);
    } catch { }
  };

  const roleScreen = useMemo(() => {
    if (!token || !user) return null;
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
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>BL</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userName}>{user.full_name}</Text>
          <Text style={styles.userRole}>{roleLabel[user.role]}</Text>
        </View>
        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Quitter</Text>
        </Pressable>
      </View>
      <View style={styles.content}>{roleScreen}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Brand.ink,
  },
  headerRight: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.ink,
  },
  userRole: {
    fontSize: 12,
    color: Brand.muted,
    marginTop: 2,
  },
  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  logoutText: {
    fontSize: 13,
    color: Brand.ink,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
});