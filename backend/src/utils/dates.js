/** UTC tarihi YYYY-MM-DD formatında döndürür. */
export function toISODate(d) {
  const x = new Date(d);
  return x.toISOString().slice(0, 10);
}

export function startOfDayUTC(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** [from, to) şeklinde bir pencere döndürür (to dahil değil). */
export function dayWindow(d) {
  const from = startOfDayUTC(d);
  const to = addDays(from, 1);
  return { from, to };
}
