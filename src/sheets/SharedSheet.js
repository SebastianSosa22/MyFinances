import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HIDDEN } from '../components/HomeCards';
import { Segmented } from '../components/ui';
import { CATS } from '../constants/budget';
import { moveTitle } from '../lib/finance';
import { money, shortDate } from '../lib/format';
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
export function SharedSheet({ visible, onClose, moves, onUpdate, hide }) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState('pending');
  const [busy, setBusy] = useState(null);
  const dayKey = new Date().toDateString();
  const data = useMemo(() => sharedBalances(moves), [moves, dayKey]);
  const fmt = (v) => (hide ? HIDDEN : money(v));

  const settle = async (p, items, paid) => {
    setBusy(p.name + paid);
    await settleItems(items, p.name, paid, onUpdate);
    setBusy(null);
  };
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
                    <Text style={s.smallMuted}>{items.length === 1 ? '1 gasto' : items.length + ' gastos'}</Text>
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
                      <Text style={[s.rowAmount, x.paid && { color: C.muted }]}>{fmt(x.amount)}</Text>
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
                    <Pressable accessibilityRole="button" onPress={() => remind(p)} style={[s.saveBtn, { marginTop: 0, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: C.raised }]} accessibilityLabel={'Recordarle a ' + p.name}>
                      <Text style={[s.saveBtnText, { fontSize: 15, color: C.text }]}>Recordarle</Text>
                    </Pressable>
                  </View>
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
