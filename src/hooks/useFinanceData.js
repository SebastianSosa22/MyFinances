import { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startOfMonth } from '../lib/dates';
import { accountBalance, spendWarning } from '../lib/accounts';
import { isRecurring, report } from '../lib/finance';
import { money } from '../lib/format';
import { limitMessage } from '../lib/summary';
import { supabase } from '../lib/supabase';
import { CACHE_PREFIX } from '../lib/session';
import { markReady, track, trackError, trackPerf } from '../lib/analytics';

const byDateDesc = (list) => [...list].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
const clean = (x) => ({ ...x, amount: Number(x.amount) });
const isTemp = (id) => String(id).startsWith('tmp-');
const cleanTransfer = (x) => ({ ...x, amount: Number(x.amount) });
const RELOAD_GAP_MS = 30000; // al volver a la app, no se vuelve a descargar todo si se cargó hace menos de 30 s
const cleanAccount = (a) => ({ ...a, opening_balance: Number(a.opening_balance), credit_limit: a.credit_limit == null ? null : Number(a.credit_limit) });

// Datos de la cuenta (movimientos, metas, límites y tarjetas/cuentas de dinero) y sus operaciones contra Supabase.
// Abre al instante con la última copia guardada en el dispositivo y se actualiza en cuanto llegan los datos.
export function useFinanceData(session) {
  const cacheKey = CACHE_PREFIX + session.user.id;
  const [moves, setMoves] = useState([]);
  const [goals, setGoals] = useState([]);
  const [limits, setLimits] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [transfers, setTransfers] = useState([]); // transferencias entre cuentas y ajustes de saldo
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [undo, setUndo] = useState(null); // último movimiento borrado, para poder deshacer
  const fresh = useRef(false);
  const undoTimer = useRef(null);
  const lastLoad = useRef(0);

  const load = async () => {
    const t0 = Date.now();
    lastLoad.current = t0;
    const [m, g, l, a, tr] = await Promise.all([
      supabase.from('movements').select('*').order('occurred_at', { ascending: false }),
      supabase.from('goals').select('*').order('created_at', { ascending: true }),
      supabase.from('category_limits').select('*'),
      supabase.from('money_accounts').select('*').order('created_at', { ascending: true }),
      supabase.from('account_transfers').select('*').order('occurred_at', { ascending: false }),
    ]);
    const error = m.error || g.error || l.error || a.error || tr.error;
    if (error) { lastLoad.current = 0; setErr('No se pudieron cargar los datos: ' + error.message); setLoaded(true); markReady(); trackError(error, 'data_load'); return; }
    trackPerf('data_load', Date.now() - t0, { rows: m.data.length });
    const mv = m.data.map(clean);
    const gl = g.data.map((x) => ({ ...x, target: Number(x.target) }));
    const lim = {};
    l.data.forEach((x) => { lim[x.cat] = Number(x.amount); });
    const ac = a.data.map(cleanAccount), tf = tr.data.map(cleanTransfer);
    fresh.current = true;
    setMoves(mv); setGoals(gl); setLimits(lim); setAccounts(ac); setTransfers(tf); setErr(''); setLoaded(true);
    markReady();
    AsyncStorage.setItem(cacheKey, JSON.stringify({ moves: mv, goals: gl, limits: lim, accounts: ac, transfers: tf })).catch(() => {});
  };

  // 1) copia local (instantánea)  2) datos frescos de Supabase
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(cacheKey).then((raw) => {
      if (!alive || !raw || fresh.current) return;
      try { const c = JSON.parse(raw); setMoves(c.moves || []); setGoals(c.goals || []); setLimits(c.limits || {}); setAccounts(c.accounts || []); setTransfers(c.transfers || []); setLoaded(true); markReady(); } catch (e) { /* copia dañada: se ignora */ }
    });
    load();
    return () => { alive = false; clearTimeout(undoTimer.current); };
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active' && Date.now() - lastLoad.current > RELOAD_GAP_MS) load(); });
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
    // Gasto con una cuenta: avisa si la tarjeta queda casi al límite o la cuenta de débito/efectivo en negativo
    const acc = row.kind === 'expense' && row.account_id && accounts.find((a) => a.id === row.account_id);
    if (acc) {
      const warn = spendWarning(acc, accountBalance(acc, moves, transfers), accountBalance(acc, [temp, ...moves], transfers), (v) => money(v, true));
      if (warn) setNotice((prev) => (prev ? prev + '\n' + warn : warn));
    }
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

  // Alta o edición de una tarjeta/cuenta de dinero
  const saveAccount = async (row, id) => {
    const q = id ? supabase.from('money_accounts').update(row).eq('id', id) : supabase.from('money_accounts').insert(row);
    const { data, error } = await q.select().single();
    if (error) { setErr('No se pudo guardar la cuenta: ' + error.message); return false; }
    track(id ? 'account_edit' : 'account_create', { type: row.type });
    const acc = cleanAccount(data);
    setAccounts((prev) => (id ? prev.map((x) => (x.id === id ? acc : x)) : [...prev, acc]));
    setErr('');
    return acc;
  };

  // Al borrar una cuenta sus movimientos se conservan, ya sin cuenta (sus transferencias y ajustes sí se borran)
  const delAccount = async (id) => {
    const prev = accounts, prevMoves = moves, prevTransfers = transfers;
    setAccounts(accounts.filter((x) => x.id !== id));
    setMoves(moves.map((m) => (m.account_id === id ? { ...m, account_id: null } : m)));
    setTransfers(transfers.filter((t) => t.from_account_id !== id && t.to_account_id !== id));
    track('account_delete');
    const { error } = await supabase.from('money_accounts').delete().eq('id', id);
    if (error) { setAccounts(prev); setMoves(prevMoves); setTransfers(prevTransfers); setErr('No se pudo borrar la cuenta: ' + error.message); return false; }
    return true;
  };

  // Transferencia entre cuentas (pagar la tarjeta, mover dinero) o ajuste de saldo
  const saveTransfer = async (row, id) => {
    const q = id ? supabase.from('account_transfers').update(row).eq('id', id) : supabase.from('account_transfers').insert(row);
    const { data, error } = await q.select().single();
    if (error) { setErr('No se pudo guardar: ' + error.message); trackError(error, 'transfer_save'); return false; }
    track(row.kind === 'adjust' ? 'account_adjust' : id ? 'transfer_edit' : 'transfer_add');
    const t = cleanTransfer(data);
    setTransfers((prev) => byDateDesc(id ? prev.map((x) => (x.id === id ? t : x)) : [t, ...prev]));
    setErr('');
    return true;
  };

  const delTransfer = async (id) => {
    const prev = transfers;
    setTransfers(transfers.filter((x) => x.id !== id));
    track('transfer_delete');
    const { error } = await supabase.from('account_transfers').delete().eq('id', id);
    if (error) { setTransfers(prev); setErr('No se pudo borrar: ' + error.message); return false; }
    return true;
  };

  return { moves, goals, limits, accounts, saveAccount, delAccount, transfers, saveTransfer, delTransfer, err, notice, setNotice, loaded, undo, undoDelete, load, addMove, updateMove, delMove, saveGoal, delGoal, contribute, saveLimit, applyLimits };
}
