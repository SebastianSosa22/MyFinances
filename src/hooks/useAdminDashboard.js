import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { timed } from '../lib/analytics';

// Datos del panel de administrador (función admin_dashboard en Supabase; solo responde a cuentas admin)
const fetchDashboard = (days) => timed('admin_load', () => supabase.rpc('admin_dashboard', { days }), { days });

export function useAdminDashboard(days) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const apply = useCallback(({ data: d, error: e }) => {
    if (e) setError('No se pudieron cargar las estadísticas: ' + e.message);
    else { setData(d); setError(''); }
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    fetchDashboard(days).then((r) => { if (alive) apply(r); });
    return () => { alive = false; };
  }, [days, apply]);

  const reload = async () => { setLoading(true); apply(await fetchDashboard(days)); };

  const setRole = async (userId, role) => {
    const { error: e } = await supabase.rpc('admin_set_role', { target: userId, new_role: role });
    if (e) { setError(e.message); return false; }
    await reload();
    return true;
  };

  return { data, loading, error, reload, setRole };
}
