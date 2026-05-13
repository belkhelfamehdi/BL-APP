import AsyncStorage from '@react-native-async-storage/async-storage';

import { User } from '@/types/app';

const KEY = 'auth:session:v1';

export interface PersistedSession {
  token: string;
  user: User;
}

export async function loadSession(): Promise<PersistedSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed?.token || !parsed?.user?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSession(session: PersistedSession): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(session));
  } catch { /* ignore */ }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch { /* ignore */ }
}
