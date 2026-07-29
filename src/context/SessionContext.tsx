import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { configureApiSession } from '../api/tokenStore';
import { LoginResponse, TokenPair } from '../types/api';

const STORAGE_KEY = 'hearo.session';

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
        setSession(JSON.parse(value) as LoginResponse);
      })
      .catch(() => AsyncStorage.removeItem(STORAGE_KEY))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    configureApiSession(
      session
        ? { accessToken: session.accessToken, refreshToken: session.refreshToken }
        : null,
      (tokens: TokenPair) => {
        setSession((current) => {
          if (!current) return current;
          const next = { ...current, ...tokens };
          void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      },
      () => {
        setSession(null);
        void AsyncStorage.removeItem(STORAGE_KEY);
      },
    );
  }, [session?.accessToken, session?.refreshToken]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      ready,
      signIn: async (next) => {
        setSession(next);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      },
      signOut: async () => {
        setSession(null);
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
