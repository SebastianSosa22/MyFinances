import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppShell } from './AppShell';
import { supabase } from './lib/supabase';
import { clearCachedData } from './lib/session';
import { SplashScreen } from './components/SplashScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';
import { s } from './theme/styles';
import { C } from './theme/colors';
import { setupPwa } from './lib/pwa';
import { startAnalytics, stopAnalytics } from './lib/analytics';

setupPwa();

export default function App() {
  const [session, setSession] = useState(undefined);
  const [splash, setSplash] = useState(true); // pantalla de carga con el logo animado
  const [recovery, setRecovery] = useState(false); // entró desde el enlace de "olvidé mi contraseña"
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) startAnalytics(data.session.user, true); });
    const { data } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') { clearCachedData(); stopAnalytics(); }
      if (sess) startAnalytics(sess.user, event === 'INITIAL_SESSION');
      setSession(sess);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={[s.root, session === null && { backgroundColor: C.loginBg }]}>
        {session === undefined ? null
          : session && recovery ? <ResetPasswordScreen onDone={() => setRecovery(false)} />
          : session ? <AppShell session={session} /> : <LoginScreen />}
      </SafeAreaView>
      {splash && <SplashScreen ready={session !== undefined} onDone={() => setSplash(false)} />}
      </View>
    </SafeAreaProvider>
  );
}
