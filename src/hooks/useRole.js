import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Rol de la cuenta ('user' o 'admin'), leído de la tabla profiles. Mientras carga se trata como 'user'.
export function useRole(session) {
  const [role, setRole] = useState('user');
  useEffect(() => {
    let alive = true;
    supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => { if (alive && data && data.role) setRole(data.role); });
    return () => { alive = false; };
  }, [session.user.id]);
  return { role, isAdmin: role === 'admin' };
}
