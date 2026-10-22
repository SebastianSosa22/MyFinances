import React, { useState, useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppShell } from './AppShell';
import { supabase } from './lib/supabase';
import { clearCachedData } from './lib/session';
import { LoginScreen } from './screens/LoginScreen';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';
import { s } from './theme/styles';
import { setupPwa } from './lib/pwa';

setupPwa();

export default function App() {
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false); // entró desde el enlace de "olvidé mi contraseña"
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') clearCachedData();
      setSession(sess);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.root}>
        {session === undefined ? <ActivityIndicator style={{ marginTop: 80 }} />
          : session && recovery ? <ResetPasswordScreen onDone={() => setRecovery(false)} />
          : session ? <AppShell session={session} /> : <LoginScreen />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
