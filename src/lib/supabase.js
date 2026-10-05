import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Datos de tu proyecto de Supabase (la clave publishable es pública por diseño; los datos se protegen con RLS).
const SUPABASE_URL = 'https://yphvecfopkaifhkndaru.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tEZCbqmFNfWtYQMRMzKZaA_EmQjCvPD';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
