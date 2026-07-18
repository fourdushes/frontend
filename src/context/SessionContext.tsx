import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { setApiAccessToken } from '../api/tokenStore';
import { LoginResponse } from '../types/api';

const STORAGE_KEY = 'hearo.cowork.session';

type SessionContextValue = {
  session: LoginResponse | null;
  ready: boolean;
  signIn: (session: LoginResponse) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!value) return;
        const restored = JSON.parse(value) as LoginResponse;
        setSession(restored);
        setApiAccessToken(restored.accessToken);
      })
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      ready,
      signIn: async (next) => {
        setSession(next);
        setApiAccessToken(next.accessToken);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      },
      signOut: async () => {
        setSession(null);
        setApiAccessToken(null);
        await AsyncStorage.removeItem(STORAGE_KEY);
      },
    }),
    [ready, session],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
