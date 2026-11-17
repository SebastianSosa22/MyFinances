import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HIDDEN } from '../components/HomeCards';
import { Segmented } from '../components/ui';
import { CATS } from '../constants/budget';
import { moveTitle } from '../lib/finance';
import { money, shortDate } from '../lib/format';
import { inviteUrl } from '../lib/invite';
import { settleSplit, sharedBalances } from '../lib/shared';
import { C } from '../theme/colors';
import { s } from '../theme/styles';
import { Avatar } from './SplitSheet';

const VIEWS = { pending: { label: 'Pendientes' }, settled: { label: 'Saldadas' } };
const iconOf = (m) => (CATS.find((c) => c.name === m.cat) || { icon: '🧾' }).icon;

// Marca como saldadas (o pendientes) varias veces de gastos de una persona: un cambio por movimiento
export async function settleItems(items, name, paid, onUpdate) {
  const byMove = new Map();
  items.forEach((x) => { if (!byMove.has(x.m.id)) byMove.set(x.m.id, { m: x.m, keys: [] }); byMove.get(x.m.id).keys.push(x.key); });
  for (const { m, keys } of byMove.values()) {
    if (!(await onUpdate(m.id, { split: settleSplit(m, name, keys, paid) }))) return false;
  }
  return true;
}

// Pantalla "Cuentas compartidas": cuánto te debe (o le debes a) cada persona, con sus gastos, y el botón para saldar.
// Lo saldado regresa (o sale de) la cuenta del gasto, pero no cuenta como ingreso ni como gasto nuevo.
export function SharedSheet({ visible, onClose, moves, onUpdate, onAddOwn, net, hide }) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState('pending');
  const [busy, setBusy] = useState(null);
  const dayKey = new Date().toDateString();
  const remote = net ? net.remote : [];
  const data = useMemo(() => sharedBalances(moves, new Date(), remote), [moves, remote, dayKey]);
  const [note, setNote] = useState('');
  const linked = new Set(net ? net.linkedNames : []);
  const added = new Set(moves.filter((m) => m.shared_from).map((m) => m.shared_from));
  const fmt = (v) => (hide ? HIDDEN : money(v));

  const settle = async (p, items, paid) => {
    setBusy(p.name + paid);
    const local = items.filter((x) => !x.remote), far = items.filter((x) => x.remote);
    if (local.length) await settleItems(local, p.name, paid, onUpdate);
    if (far.length && net) { if (!(await net.markRemote(far, paid))) setNote('No se pudo guardar el pago. Revisa tu conexión e inténtalo de nuevo.'); }
    setBusy(null);
  };
  // Invitar a la app: se crea (o reusa) el link y se comparte por WhatsApp, correo, etc.
  const invite = async (p) => {
    setBusy('inv' + p.name); setNote('');
    const res = await net.invite(p.name);
    setBusy(null);
    if (res.error) { setNote('No se pudo crear la invitación: ' + res.error); return; }
    if (res.linked) { setNote(p.name + ' ya usa la app contigo.'); return; }
    const url = inviteUrl(res.code);
    Share.share({ message: 'Hola ' + p.name + ', te invito a ver nuestros gastos compartidos en Finanzas: ' + url, url }).catch(() => {});
    setNote('Link para ' + p.name + ': ' + url);
  };
  // Pasar tu parte de un gasto de otra persona a tu propio presupuesto
  const addOwn = (x) => onAddOwn({ kind: 'expense', cat: x.m.cat || 'Otros gastos', amount: x.amount, note: (moveTitle(x.m) + ' · con ' + x.m.owner_name).slice(0, 200),
    freq: x.m.freq || 'once', day: x.m.day ?? null, ends_at: x.m.ends_at || null, occurred_at: x.m.occurred_at, account_id: null, shared_from: x.m.id });
  const remind = (p) => {
    const list = p.items.filter((x) => !x.paid && x.dir === 'in');
    const what = list.slice(0, 3).map((x) => moveTitle(x.m) + ' (' + money(x.amount) + ')').join(', ');
    Share.share({ message: 'Hola ' + p.name + ', te paso la cuenta: me debes ' + money(p.owesMe) + (what ? ' de ' + what : '') + '. ¡Gracias!' }).catch(() => {});
  };

  const people = data.people.filter((p) => p.items.some((x) => (view === 'pending' ? !x.paid : x.paid)));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.addScreen, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 12 }]}>
        <View style={s.grabber} />
        <View style={s.addHead}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar" style={{ width: 80, paddingVertical: 8 }}><Text style={[s.smallMuted, { fontSize: 15 }]}>Cerrar</Text></Pressable>
          <Text style={[s.panelTitle, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>Cuentas compartidas</Text>
          <View style={{ width: 80 }} />
        </View>
        <View style={[s.tileRow, { marginTop: 12 }]}>
          <View style={s.tile}><Text style={s.tileLabel}>Te deben</Text><Text style={[s.tileValue, { color: C.green }]}>{fmt(data.owedToMe)}</Text></View>
          <View style={s.tile}><Text style={s.tileLabel}>Debes</Text><Text style={[s.tileValue, data.iOwe > 0 && { color: C.orange }]}>{fmt(data.iOwe)}</Text></View>
        </View>
        <Segmented options={VIEWS} value={view} onChange={setView} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
          {!!note && <Text selectable style={[s.smallMuted, { textAlign: 'center', marginTop: 12, color: C.text }]}>{note}</Text>}
          {people.length === 0 && (
            <Text style={s.hint}>{view === 'pending' ? 'Nadie te debe y no debes nada. 🎉\nPara dividir un gasto, tócalo con + y usa "Dividir gasto".' : 'Aquí verás lo que ya se saldó.'}</Text>
          )}
          {people.map((p) => {
            const items = p.items.filter((x) => (view === 'pending' ? !x.paid : x.paid));
            const inItems = items.filter((x) => x.dir === 'in'), outItems = items.filter((x) => x.dir === 'out');
            return (
              <View key={p.name} style={s.panel}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={p.name} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.panelTitle} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.smallMuted}>{items.length === 1 ? '1 gasto' : items.length + ' gastos'}{(p.linked || linked.has(p.name)) ? ' · ✓ usa la app' : ''}</Text>
                  </View>
                  {view === 'pending' && (
                    <View style={{ alignItems: 'flex-end' }}>
                      {p.owesMe > 0 && <><Text style={s.smallMuted}>Te debe</Text><Text style={[s.rowAmount, { fontSize: 19, color: C.green }]}>{fmt(p.owesMe)}</Text></>}
                      {p.iOwe > 0 && <><Text style={s.smallMuted}>Le debes</Text><Text style={[s.rowAmount, { fontSize: 19, color: C.orange }]}>{fmt(p.iOwe)}</Text></>}
                    </View>
                  )}
                </View>
                <View style={{ backgroundColor: C.inset, borderRadius: 14, paddingHorizontal: 12 }}>
                  {items.map((x, i) => (
                    <View key={x.m.id + x.key + x.dir} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }, i > 0 && s.sep]}>
                      <Text style={{ fontSize: 20 }}>{iconOf(x.m)}</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.rowTitle, x.paid && { color: C.muted }]} numberOfLines={1}>{moveTitle(x.m)}</Text>
                        <Text style={s.smallMuted} numberOfLines={1}>{shortDate(x.date)} · {x.dir === 'in' ? 'te debe' : 'le debes'} · de {money(Number(x.m.split.total) || x.m.amount)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[s.rowAmount, x.paid && { color: C.muted }]}>{fmt(x.amount)}</Text>
                        {x.remote && x.dir === 'out' && onAddOwn && (added.has(x.m.id)
                          ? <Text style={[s.smallMuted, { fontSize: 11 }]}>En tus gastos ✓</Text>
                          : <Pressable accessibilityRole="button" hitSlop={6} onPress={() => addOwn(x)}><Text style={[s.linkSm, { fontSize: 12 }]}>+ A mis gastos</Text></Pressable>)}
                      </View>
                      {view === 'settled' && (
                        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => settle(p, [x], false)} accessibilityLabel="Volver a pendiente"><Text style={s.linkSm}>Deshacer</Text></Pressable>
                      )}
                    </View>
                  ))}
                </View>
                {view === 'pending' && inItems.length > 0 && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => settle(p, inItems, true)} style={[s.saveBtn, { flex: 1, marginTop: 0, paddingVertical: 13, backgroundColor: C.primary }]}>
                      <Text style={[s.saveBtnText, { fontSize: 15 }]}>{busy === p.name + true ? 'Guardando…' : p.name + ' me pagó ' + fmt(p.owesMe)}</Text>
                    </Pressable>
                    {inItems.some((x) => !x.remote) && <Pressable accessibilityRole="button" onPress={() => remind(p)} style={[s.saveBtn, { marginTop: 0, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: C.raised }]} accessibilityLabel={'Recordarle a ' + p.name}>
                      <Text style={[s.saveBtnText, { fontSize: 15, color: C.text }]}>Recordarle</Text>
                    </Pressable>}
                  </View>
                )}
                {net && !p.linked && !linked.has(p.name) && p.items.some((x) => !x.remote) && (
                  <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => invite(p)} hitSlop={6}>
                    <Text style={[s.linkSm, { textAlign: 'center', fontSize: 14 }]}>{busy === 'inv' + p.name ? 'Creando link…' : '📨 Invitar a ' + p.name + ' a la app para que vea esto'}</Text>
                  </Pressable>
                )}
                {view === 'pending' && outItems.length > 0 && (
                  <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => settle(p, outItems, true)} style={[s.saveBtn, { marginTop: 0, paddingVertical: 13, backgroundColor: 'transparent', borderWidth: 1, borderColor: C.orange }]}>
                    <Text style={[s.saveBtnText, { fontSize: 15, color: C.orange }]}>{busy === p.name + true ? 'Guardando…' : 'Ya le pagué ' + fmt(p.iOwe)}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          {view === 'pending' && people.length > 0 && (
            <Text style={[s.smallMuted, { textAlign: 'center', marginTop: 14 }]}>Al saldar, el dinero entra o sale de la cuenta del gasto, sin contar como ingreso ni como gasto nuevo.</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
