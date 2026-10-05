export const DAY_MS = 864e5;

export const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();

export const nextDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

export function periodStart(p, now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (p === 'weekly') return new Date(y, m, d - ((now.getDay() + 6) % 7));
  if (p === 'biweekly') return new Date(y, m, d <= 15 ? 1 : 16);
  return new Date(y, m, 1);
}

export function periodEnd(p, start) {
  const y = start.getFullYear(), m = start.getMonth();
  if (p === 'weekly') return new Date(y, m, start.getDate() + 6);
  if (p === 'biweekly') return start.getDate() === 1 ? new Date(y, m, 15) : new Date(y, m + 1, 0);
  return new Date(y, m + 1, 0);
}

export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
