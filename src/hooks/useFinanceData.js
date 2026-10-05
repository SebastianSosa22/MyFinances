import { useState, useEffect } from 'react';
import { AppState } from 'react-native';
import { startOfMonth } from '../lib/dates';
import { report } from '../lib/finance';
import { limitMessage } from '../lib/summary';
import { supabase } from '../lib/supabase';

// Datos de la cuenta (movimientos, metas y límites) y sus operaciones contra Supabase
export function useFinanceData(session) {
  const [moves, setMoves] = useState([]);
  const [goals, setGoals] = useState([]);
  const [limits, setLimits] = useState({});
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    const [m, g, l] = await Promise.all([
      supabase.from('movements').select('*').order('occurred_at', { ascending: false }),
      supabase.from('goals').select('*').order('created_at', { ascending: true }),
      supabase.from('category_limits').select('*'),
    ]);
    const error = m.error || g.error || l.error;
    if (error) { setErr('No se pudieron cargar los datos: ' + error.message); return; }
    setMoves(m.data.map((x) => ({ ...x, amount: Number(x.amount) })));
    setGoals(g.data.map((x) => ({ ...x, target: Number(x.target) })));
    const lim = {};
    l.data.forEach((x) => { lim[x.cat] = Number(x.amount); });
    setLimits(lim);
    setErr('');
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    return () => sub.remove();
  }, []);

  const addMove = async (row) => {
    const { data, error } = await supabase.from('movements').insert(row).select().single();
    if (error) { setErr('No se pudo guardar: ' + error.message); return false; }
    setMoves((prev) => [{ ...data, amount: Number(data.amount) }, ...prev]);
    setErr('');
    const lim = limits[row.cat];
    if (row.kind === 'expense' && lim && (!row.freq || row.freq === 'once')) {
      const now = new Date();
      const monthByCat = report(moves, startOfMonth(now), now).byCat;
      setNotice(limitMessage(row.cat, (monthByCat[row.cat] || 0) + row.amount, lim));
    } else setNotice('');
    return true;
  };

  const delMove = async (id) => {
    const prev = moves;
    setMoves(moves.filter((m) => m.id !== id));
    const { error } = await supabase.from('movements').delete().eq('id', id);
    if (error) { setMoves(prev); setErr('No se pudo borrar: ' + error.message); }
  };

  const saveGoal = async (row, id) => {
    const q = id ? supabase.from('goals').update(row).eq('id', id) : supabase.from('goals').insert(row);
    const { data, error } = await q.select().single();
    if (error) { setErr('No se pudo guardar la meta: ' + error.message); return false; }
    const g = { ...data, target: Number(data.target) };
    setGoals((prev) => (id ? prev.map((x) => (x.id === id ? g : x)) : [...prev, g]));
    setErr('');
    return true;
  };

  const delGoal = async (id) => {
    const prev = goals;
    setGoals(goals.filter((x) => x.id !== id));
    setMoves(moves.map((m) => (m.goal_id === id ? { ...m, goal_id: null } : m)));
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) { setGoals(prev); load(); setErr('No se pudo borrar la meta: ' + error.message); }
  };

  // Un aporte a una meta se guarda como gasto de Ahorro ligado a la meta
  const contribute = (goal, amount) => addMove({ kind: 'expense', cat: 'Ahorro', amount, note: 'Aporte · ' + goal.name, goal_id: goal.id, occurred_at: new Date().toISOString() });

  const saveLimit = async (cat, value) => {
    if ((value || null) === (limits[cat] || null)) return;
    const { error } = value
      ? await supabase.from('category_limits').upsert({ user_id: session.user.id, cat, amount: value }, { onConflict: 'user_id,cat' })
      : await supabase.from('category_limits').delete().eq('cat', cat);
    if (error) { setErr('No se pudo guardar el límite: ' + error.message); return; }
    setLimits((p) => { const n = { ...p }; if (value) n[cat] = value; else delete n[cat]; return n; });
  };

  return { moves, goals, limits, err, notice, setNotice, load, addMove, delMove, saveGoal, delGoal, contribute, saveLimit };
}
