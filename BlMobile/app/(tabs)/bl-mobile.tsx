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

const roleConfig: Record<User['role'], { label: string; color: string; bg: string }> = {
  responsable: { label: 'Responsable', color: '#1565C0', bg: '#E3F2FD' },
  preparateur: { label: 'Préparateur', color: '#2E7D32', bg: '#E8F5E9' },
  admin: { label: 'Administrateur', color: '#6A1B9A', bg: '#F3E5F5' },
};

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
  return (
    <View style={avatar.container}>
      <Text style={avatar.text}>{initials}</Text>
    </View>
  );
}

const avatar = StyleSheet.create({
  container: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Brand.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

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
    } catch {}
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

  const rc = roleConfig[user.role];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <UserAvatar name={user.full_name} />
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {user.full_name}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: rc.bg }]}>
            <Text style={[styles.roleText, { color: rc.color }]}>{rc.label}</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.7 }]}
          onPress={onLogout}
          hitSlop={8}>
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
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    gap: 12,
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.ink,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  logoutBtn: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  logoutText: {
    fontSize: 13,
    color: Brand.muted,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
});
