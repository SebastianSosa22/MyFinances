export const commas = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const money = (n, cents) => {
  const d = cents || !Number.isInteger(n) ? 2 : 0;
  const [i, f] = Math.abs(n).toFixed(d).split('.');
  return (n < 0 ? '-' : '') + '$' + commas(i) + (f ? '.' + f : '');
};

export const cleanAmount = (t) => {
  const parts = t.replace(/[^0-9.]/g, '').split('.');
  const int = parts[0].replace(/^0+(?=\d)/, '');
  return parts.length > 1 ? int + '.' + parts.slice(1).join('').slice(0, 2) : int;
};

export const showAmount = (raw) => (raw === '' ? '' : '$' + commas(raw.split('.')[0] || '0') + (raw.includes('.') ? '.' + raw.split('.')[1] : ''));

export const monthName = (d) => { const x = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }); return x.charAt(0).toUpperCase() + x.slice(1); };

export const isoLocal = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export const shortDate = (d) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
