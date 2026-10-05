import React, { useState, useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppShell } from './AppShell';
import { supabase } from './lib/supabase';
import { LoginScreen } from './screens/LoginScreen';
import { s } from './theme/styles';

export default function App() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.root}>
        {session === undefined ? <ActivityIndicator style={{ marginTop: 80 }} /> : session ? <AppShell session={session} /> : <LoginScreen />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
