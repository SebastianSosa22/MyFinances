import { Platform, Share } from 'react-native';
import { isoLocal } from './format';

// Evita que Excel interprete un texto como fórmula
const cell = (v) => {
  let t = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
};

export function movesToCsv(moves) {
  const head = ['Fecha', 'Tipo', 'Categoría', 'Concepto', 'Monto', 'Frecuencia', 'Día', 'Termina'];
  const rows = [...moves]
    .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))
    .map((m) => [
      isoLocal(new Date(m.occurred_at)), m.kind === 'income' ? 'Ingreso' : 'Gasto', m.cat || '', m.note || '',
      Number(m.amount).toFixed(2), m.freq || 'once', m.day == null ? '' : m.day, m.ends_at || '',
    ]);
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

// Web: comparte o descarga el archivo; app nativa: abre el menú de compartir
export async function exportMovesCsv(moves) {
  const csv = movesToCsv(moves);
  const name = 'finanzas-' + isoLocal(new Date()) + '.csv';
  if (Platform.OS !== 'web') { await Share.share({ message: csv, title: name }); return; }
  const file = typeof File !== 'undefined' ? new File(['\ufeff' + csv], name, { type: 'text/csv' }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
