import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

const AuthContext = createContext<{ session: Session | null; loading: boolean; error: string | null }>({ session: null, loading: true, error: null });

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const client = supabase;
    if (!client) { setError('Account connection is not configured.'); setLoading(false); return; }
    let active = true;
    let authEventReceived = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true;
      if (active) { setSession(nextSession); setLoading(false); }
    });
    client.auth.getSession().then(({ data, error: restoreError }) => {
      if (!active || authEventReceived) return;
      setSession(data.session);
      setError(restoreError ? 'Could not restore your session. Please try signing in again.' : null);
      setLoading(false);
    }).catch(() => {
      if (active) { setError('Could not restore your session. Please try again.'); setLoading(false); }
    });
    const refresh = (state: string) => state === 'active' ? client.auth.startAutoRefresh() : client.auth.stopAutoRefresh();
    refresh(AppState.currentState);
    const listener = AppState.addEventListener('change', refresh);
    return () => { active = false; subscription.unsubscribe(); listener.remove(); client.auth.stopAutoRefresh(); };
  }, []);
  return <AuthContext.Provider value={{ session, loading, error }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
