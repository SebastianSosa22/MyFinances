import { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startOfMonth } from '../lib/dates';
import { isRecurring, report } from '../lib/finance';
import { limitMessage } from '../lib/summary';
import { supabase } from '../lib/supabase';
import { CACHE_PREFIX } from '../lib/session';
import { track, trackError, trackPerf } from '../lib/analytics';

const byDateDesc = (list) => [...list].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
const clean = (x) => ({ ...x, amount: Number(x.amount) });
const isTemp = (id) => String(id).startsWith('tmp-');

// Datos de la cuenta (movimientos, metas y límites) y sus operaciones contra Supabase.
// Abre al instante con la última copia guardada en el dispositivo y se actualiza en cuanto llegan los datos.
export function useFinanceData(session) {
  const cacheKey = CACHE_PREFIX + session.user.id;
  const [moves, setMoves] = useState([]);
  const [goals, setGoals] = useState([]);
  const [limits, setLimits] = useState({});
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [undo, setUndo] = useState(null); // último movimiento borrado, para poder deshacer
  const fresh = useRef(false);
  const undoTimer = useRef(null);

  const load = async () => {
    const t0 = Date.now();
    const [m, g, l] = await Promise.all([
      supabase.from('movements').select('*').order('occurred_at', { ascending: false }),
      supabase.from('goals').select('*').order('created_at', { ascending: true }),
      supabase.from('category_limits').select('*'),
    ]);
    const error = m.error || g.error || l.error;
    if (error) { setErr('No se pudieron cargar los datos: ' + error.message); setLoaded(true); trackError(error, 'data_load'); return; }
    trackPerf('data_load', Date.now() - t0, { rows: m.data.length });
    const mv = m.data.map(clean);
    const gl = g.data.map((x) => ({ ...x, target: Number(x.target) }));
    const lim = {};
    l.data.forEach((x) => { lim[x.cat] = Number(x.amount); });
    fresh.current = true;
    setMoves(mv); setGoals(gl); setLimits(lim); setErr(''); setLoaded(true);
    AsyncStorage.setItem(cacheKey, JSON.stringify({ moves: mv, goals: gl, limits: lim })).catch(() => {});
  };

  // 1) copia local (instantánea)  2) datos frescos de Supabase
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(cacheKey).then((raw) => {
      if (!alive || !raw || fresh.current) return;
      try { const c = JSON.parse(raw); setMoves(c.moves || []); setGoals(c.goals || []); setLimits(c.limits || {}); setLoaded(true); } catch (e) { /* copia dañada: se ignora */ }
    });
    load();
    return () => { alive = false; clearTimeout(undoTimer.current); };
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    return () => sub.remove();
  }, []);

  // Se guarda de inmediato en pantalla y se confirma en segundo plano (si falla, se revierte y se avisa)
  const addMove = async (row) => {
    const temp = { id: 'tmp-' + Date.now(), ...row, amount: Number(row.amount), freq: row.freq || 'once' };
    setMoves((prev) => byDateDesc([temp, ...prev]));
    setErr('');
    const lim = limits[row.cat];
    const now = new Date();
    if (row.kind === 'expense' && lim && !isRecurring(row) && new Date(row.occurred_at) >= startOfMonth(now)) {
      const monthByCat = report(moves, startOfMonth(now), now).byCat;
      setNotice(limitMessage(row.cat, (monthByCat[row.cat] || 0) + row.amount, lim));
    } else setNotice('');
    track('movement_add', { kind: row.kind, cat: row.cat || null, freq: row.freq || 'once', note: !!row.note, goal: !!row.goal_id });
    const t0 = Date.now();
    supabase.from('movements').insert(row).select().single().then(({ data, error }) => {
      if (error) { setMoves((prev) => prev.filter((m) => m.id !== temp.id)); setErr('No se pudo guardar: ' + error.message); trackError(error, 'movement_add'); return; }
      trackPerf('save_movement', Date.now() - t0);
      setMoves((prev) => byDateDesc(prev.map((m) => (m.id === temp.id ? clean(data) : m))));
    });
    return true;
  };

  const updateMove = async (id, patch) => {
    if (isTemp(id)) return false;
    const prev = moves;
    setMoves(byDateDesc(moves.map((m) => (m.id === id ? { ...m, ...patch } : m))));
    const { error } = await supabase.from('movements').update(patch).eq('id', id);
    if (error) { setMoves(prev); setErr('No se pudo guardar: ' + error.message); trackError(error, 'movement_edit'); return false; }
    track('movement_edit', { fields: Object.keys(patch).join(',') });
    setErr('');
    return true;
  };

  const delMove = async (id) => {
    if (isTemp(id)) return;
    const row = moves.find((m) => m.id === id);
    if (!row) return;
    const prev = moves;
    setMoves(moves.filter((m) => m.id !== id));
    const { error } = await supabase.from('movements').delete().eq('id', id);
    if (error) { setMoves(prev); setErr('No se pudo borrar: ' + error.message); return; }
    setUndo({ row });
    track('movement_delete', { kind: row.kind, cat: row.cat || null });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 7000);
  };

  const undoDelete = async () => {
    if (!undo) return;
    const { row } = undo;
    setUndo(null);
    clearTimeout(undoTimer.current);
    track('movement_undo');
    setMoves((prev) => byDateDesc([row, ...prev]));
    const { error } = await supabase.from('movements').insert(row);
    if (error) { setMoves((prev) => prev.filter((m) => m.id !== row.id)); setErr('No se pudo deshacer: ' + error.message); }
  };

  const saveGoal = async (row, id) => {
    const q = id ? supabase.from('goals').update(row).eq('id', id) : supabase.from('goals').insert(row);
    const { data, error } = await q.select().single();
    if (error) { setErr('No se pudo guardar la meta: ' + error.message); return false; }
    track(id ? 'goal_edit' : 'goal_create', { deadline: !!row.deadline });
    const g = { ...data, target: Number(data.target) };
    setGoals((prev) => (id ? prev.map((x) => (x.id === id ? g : x)) : [...prev, g]));
    setErr('');
    return true;
  };

  const delGoal = async (id) => {
    const prev = goals;
    setGoals(goals.filter((x) => x.id !== id));
    setMoves(moves.map((m) => (m.goal_id === id ? { ...m, goal_id: null } : m)));
    track('goal_delete');
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) { setGoals(prev); load(); setErr('No se pudo borrar la meta: ' + error.message); }
  };

  // Un aporte a una meta se guarda como gasto de Ahorro ligado a la meta
  const contribute = (goal, amount) => (track('goal_contribute'), addMove({ kind: 'expense', cat: 'Ahorro', amount, note: 'Aporte · ' + goal.name, goal_id: goal.id, occurred_at: new Date().toISOString() }));

  const saveLimit = async (cat, value) => {
    if ((value || null) === (limits[cat] || null)) return;
    const { error } = value
      ? await supabase.from('category_limits').upsert({ user_id: session.user.id, cat, amount: value }, { onConflict: 'user_id,cat' })
      : await supabase.from('category_limits').delete().eq('cat', cat);
    if (error) { setErr('No se pudo guardar el límite: ' + error.message); return; }
    setLimits((p) => { const n = { ...p }; if (value) n[cat] = value; else delete n[cat]; return n; });
    track(value ? 'limit_set' : 'limit_remove', { cat });
  };

  // Guarda varios límites a la vez (por ejemplo, los sugeridos según tu historial)
  const applyLimits = async (map) => {
    const rows = Object.entries(map).map(([cat, amount]) => ({ user_id: session.user.id, cat, amount }));
    if (!rows.length) return true;
    const { error } = await supabase.from('category_limits').upsert(rows, { onConflict: 'user_id,cat' });
    if (error) { setErr('No se pudieron guardar los límites: ' + error.message); return false; }
    setLimits((p) => ({ ...p, ...map }));
    track('limits_apply_suggested', { count: rows.length });
    return true;
  };

  return { moves, goals, limits, err, notice, setNotice, loaded, undo, undoDelete, load, addMove, updateMove, delMove, saveGoal, delGoal, contribute, saveLimit, applyLimits };
}
