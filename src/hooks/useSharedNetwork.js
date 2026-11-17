import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { track, trackError } from '../lib/analytics';
import { supabase } from '../lib/supabase';

// Gastos compartidos con otros usuarios (fase 2): tus contactos ligados y los gastos de otros donde apareces.
// Si las tablas aún no existen o no hay red, todo queda vacío y la fase 1 sigue funcionando igual.
export function useSharedNetwork(session) {
  const [contacts, setContacts] = useState([]);
  const [remote, setRemote] = useState([]);
  const last = useRef(0);

  const load = async () => {
    last.current = Date.now();
    const [c, r] = await Promise.all([
      supabase.from('shared_contacts').select('id,name,linked_user_id,invite_code,accepted_at'),
      supabase.rpc('shared_with_me'),
    ]);
    if (!c.error) setContacts(c.data || []);
    if (!r.error) setRemote((r.data || []).map((x) => ({ ...x, amount: Number(x.amount) })));
  };

  useEffect(() => {
    Promise.resolve().then(load); // fuera del efecto: la carga actualiza el estado al llegar los datos
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active' && Date.now() - last.current > 30000) load(); });
    return () => sub.remove();
  }, [session.user.id]);

  // Link de invitación para una persona (por el nombre que usas en tus gastos). Devuelve { code } o { linked: true }.
  const invite = async (name) => {
    const { data, error } = await supabase.rpc('create_shared_invite', { person: name });
    if (error) { trackError(error, 'shared_invite'); return { error: error.message }; }
    track('shared_invite');
    load();
    return data;
  };
  const inviteInfo = async (code) => {
    const { data, error } = await supabase.rpc('shared_invite_info', { code });
    return error ? { ok: false, reason: 'error', message: error.message } : data;
  };
  const accept = async (code) => {
    const { data, error } = await supabase.rpc('accept_shared_invite', { code });
    if (error) { trackError(error, 'shared_accept'); return { ok: false, reason: 'error', message: error.message }; }
    if (data && data.ok) { track('shared_accept'); load(); }
    return data;
  };
  // Saldar (o volver a pendiente) lo tuyo en gastos de otra persona: una llamada por gasto
  const markRemote = async (items, paid) => {
    const byMove = new Map();
    items.forEach((x) => { if (!byMove.has(x.m.id)) byMove.set(x.m.id, []); byMove.get(x.m.id).push(x.key); });
    let ok = true;
    for (const [id, keys] of byMove) {
      const { data, error } = await supabase.rpc('mark_shared_paid', { movement: id, keys, paid });
      if (error || !data) { ok = false; if (error) trackError(error, 'shared_mark'); }
    }
    track('shared_mark', { paid, n: items.length });
    await load();
    return ok;
  };
  const linkedNames = contacts.filter((c) => c.linked_user_id).map((c) => c.name);
  return { contacts, remote, linkedNames, invite, inviteInfo, accept, markRemote, reload: load };
}
