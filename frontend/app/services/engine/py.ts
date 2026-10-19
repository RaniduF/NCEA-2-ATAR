// Small re-implementations of Python built-ins whose exact semantics the
// backend's results depend on. Keep these bit-for-bit faithful.

/**
 * CPython (3.12+) `sum()` over floats: Neumaier-compensated summation.
 * The backend runs on python:3.12, so a plain `reduce((a, b) => a + b)` can
 * differ from it in the last bits.
 */
export function pySum(values: Iterable<number>): number {
  let fResult = 0;
  let c = 0;
  let first = true;
  for (const x of values) {
    if (first) {
      // sum() starts from int 0; `0 + x` is exactly x.
      fResult = x;
      first = false;
      continue;
    }
    const t = fResult + x;
    if (Math.abs(fResult) >= Math.abs(x)) {
      c += (fResult - t) + x;
    } else {
      c += (x - t) + fResult;
    }
    fResult = t;
  }
  if (c && Number.isFinite(c)) {
    fResult += c;
  }
  return fResult;
}

type SortKey = number | number[];

function compareKeys(a: SortKey, b: SortKey): number {
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
  const aa = a as number[];
  const bb = b as number[];
  for (let i = 0; i < Math.min(aa.length, bb.length); i++) {
    if (aa[i] < bb[i]) return -1;
    if (aa[i] > bb[i]) return 1;
  }
  return aa.length - bb.length;
}

/** Python `max(items, key=fn)`: the first maximal element wins ties. */
export function pyMax<T>(items: T[], key: (item: T) => SortKey): T {
  let best = items[0];
  let bestKey = key(best);
  for (let i = 1; i < items.length; i++) {
    const k = key(items[i]);
    if (compareKeys(k, bestKey) > 0) {
      best = items[i];
      bestKey = k;
    }
  }
  return best;
}

/** Stable ascending sort by a (tuple) key, like Python's `list.sort(key=...)`. */
export function pySortBy<T>(items: T[], key: (item: T) => SortKey): T[] {
  return items
    .map((item, i) => ({ item, k: key(item), i }))
    .sort((a, b) => compareKeys(a.k, b.k) || a.i - b.i)
    .map((x) => x.item);
}

/** Python `str.title()`. */
export function pyTitle(s: string): string {
  let out = '';
  let prevCased = false;
  for (const ch of s) {
    const lower = ch.toLowerCase();
    const upper = ch.toUpperCase();
    const cased = lower !== upper;
    out += cased ? (prevCased ? lower : upper) : ch;
    prevCased = cased;
  }
  return out;
}

/** Python `str.isdigit()` for the characters that can reach the database (ASCII and Unicode decimal digits). */
export function pyIsDigit(s: string): boolean {
  return s.length > 0 && /^\p{Nd}+$/u.test(s);
}

/** Python `s[:n]` (code points, not UTF-16 units). */
export function pySlice(s: string, n: number): string {
  return Array.from(s).slice(0, n).join('');
}

/** Python `len(s)` (code points). */
export function pyLen(s: string): number {
  let n = 0;
  for (const _ of s) n++; // eslint-disable-line @typescript-eslint/no-unused-vars
  return n;
}

/** Python string ordering (by code point), for `sorted()` of strings. */
export function compareCodePoints(a: string, b: string): number {
  const aa = Array.from(a);
  const bb = Array.from(b);
  for (let i = 0; i < Math.min(aa.length, bb.length); i++) {
    const x = aa[i].codePointAt(0)!;
    const y = bb[i].codePointAt(0)!;
    if (x !== y) return x - y;
  }
  return aa.length - bb.length;
}
