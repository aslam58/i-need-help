import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useAuth } from '../auth/AuthProvider';
import { Area, coarsePoint, PILOT_AREA, withinPilot } from './location';

const AreaContext = createContext<{ area: Area; locating: boolean; message: string; selectManual: () => void; locate: () => Promise<void> }>({ area: PILOT_AREA, locating: false, message: '', selectManual: () => {}, locate: async () => {} });
export const useArea = () => useContext(AreaContext);

export function RequestProviders({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15000 } } }));
  const [area, setArea] = useState<Area>(PILOT_AREA);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const ticket = useRef(0);
  useEffect(() => { client.removeQueries({ predicate: q => (q.queryKey[0] === 'request' ? q.queryKey[2] : q.queryKey[1]) !== session?.user.id }); ticket.current++; setArea(PILOT_AREA); setLocating(false); setMessage(''); }, [session?.user.id, client]);
  useEffect(() => {
    focusManager.setFocused(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', state => focusManager.setFocused(state === 'active'));
    return () => { listener.remove(); ticket.current++; };
  }, []);
  function selectManual() { ticket.current++; setArea(PILOT_AREA); setLocating(false); setMessage('Puducherry centre selected. Location permission is not needed.'); }
  async function locate() {
    const attempt = ++ticket.current;
    setLocating(true); setMessage('');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (attempt !== ticket.current) return;
      if (permission.status !== 'granted') { setArea(PILOT_AREA); setMessage('Location permission is off. You can still use Puducherry centre.'); return; }
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 15000); }),
      ]);
      if (attempt !== ticket.current) return;
      // Round on-device: precise GPS coordinates never enter a request or query payload.
      const point = { ...coarsePoint(position.coords.latitude, position.coords.longitude), label: 'Near my area' };
      if (!withinPilot(point)) { setArea(PILOT_AREA); setMessage('This pilot covers Puducherry. Puducherry centre is selected instead.'); return; }
      setArea(point); setMessage('Approximate area selected. Exact GPS coordinates are not shared.');
    } catch { if (attempt === ticket.current) { setArea(PILOT_AREA); setMessage('Could not get your location. You can use Puducherry centre instead.'); } }
    finally { if (timer) clearTimeout(timer); if (attempt === ticket.current) setLocating(false); }
  }
  return <QueryClientProvider client={client}><AreaContext.Provider value={{ area, locating, message, locate, selectManual }}>{children}</AreaContext.Provider></QueryClientProvider>;
}
