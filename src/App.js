import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppShell } from './AppShell';
import { supabase } from './lib/supabase';
import { clearCachedData } from './lib/session';
import { LoginScreen } from './screens/LoginScreen';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';
import { s } from './theme/styles';
import { C } from './theme/colors';
import { setupPwa } from './lib/pwa';
import { startAnalytics, stopAnalytics } from './lib/analytics';

setupPwa();

export default function App() {
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false); // entró desde el enlace de "olvidé mi contraseña"
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) startAnalytics(data.session.user); });
    const { data } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') { clearCachedData(); stopAnalytics(); }
      if (sess) startAnalytics(sess.user);
      setSession(sess);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.root, session === null && { backgroundColor: C.loginBg }]}>
        {session === undefined ? <ActivityIndicator style={{ marginTop: 80 }} color={C.muted} />
          : session && recovery ? <ResetPasswordScreen onDone={() => setRecovery(false)} />
          : session ? <AppShell session={session} /> : <LoginScreen />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
