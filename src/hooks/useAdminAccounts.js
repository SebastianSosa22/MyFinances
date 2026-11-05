import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { timed } from '../lib/analytics';

// Lista de cuentas registradas (función admin_accounts en Supabase; solo responde a cuentas admin).
// Lee directo de auth.users, así que aparecen todas las cuentas aunque nunca hayan abierto la app.
const fetchAccounts = () => timed('admin_accounts_load', () => supabase.rpc('admin_accounts'));

export function useAdminAccounts(enabled) {
  const [accounts, setAccounts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const apply = useCallback(({ data, error: e }) => {
    if (e) setError('No se pudieron cargar las cuentas: ' + e.message);
    else { setAccounts(data || []); setError(''); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled || accounts) return undefined;
    let alive = true;
    fetchAccounts().then((r) => { if (alive) apply(r); });
    return () => { alive = false; };
  }, [enabled, accounts, apply]);

  const reload = async () => { setLoading(true); apply(await fetchAccounts()); };

  // La primera carga se cuenta como "cargando" sin tocar el estado dentro del efecto
  return { accounts, loading: loading || (enabled && !accounts && !error), error, reload };
}
