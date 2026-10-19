// Port of `thefuzz.process.extractOne(query, choices)` with its defaults
// (scorer=fuzz.WRatio, processor=utils.full_process), as used by the backend's
// "did you mean" subject suggestion. The scorers follow rapidfuzz's reference
// implementation (rapidfuzz/fuzz_py.py, MIT, (c) Max Bachmann). Score cut-offs are
// omitted: in rapidfuzz they only zero out scores that cannot win.

type Seq = number[]; // code points

function toSeq(s: string): Seq {
  return Array.from(s, (ch) => ch.codePointAt(0)!);
}

/**
 * Longest-common-subsequence length of `pattern` against windows of other sequences.
 * Patterns of <= 32 code points use the bit-parallel algorithm (Hyyrö 2004, as in
 * rapidfuzz), which is exact and O(window length); longer ones fall back to DP.
 */
class LcsPattern {
  private readonly matchMasks = new Map<number, number>();

  constructor(private readonly pattern: Seq) {
    if (pattern.length <= 32) {
      pattern.forEach((ch, i) => {
        this.matchMasks.set(ch, ((this.matchMasks.get(ch) ?? 0) | (1 << i)) >>> 0);
      });
    }
  }

  lcs(text: Seq, start = 0, end = text.length): number {
    const m = this.pattern.length;
    if (!m || end <= start) return 0;
    if (m <= 32) {
      const mask = m === 32 ? 0xffffffff : ((1 << m) >>> 0) - 1;
      let s = mask;
      for (let j = start; j < end; j++) {
        const u = (s & (this.matchMasks.get(text[j]) ?? 0)) >>> 0;
        s = (((s + u) >>> 0) | (s - u)) >>> 0;
      }
      let zeros = ~s & mask;
      let count = 0;
      while (zeros) {
        zeros &= zeros - 1;
        count++;
      }
      return count;
    }
    let prev = new Int32Array(end - start + 1);
    let cur = new Int32Array(end - start + 1);
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= end - start; j++) {
        cur[j] = this.pattern[i - 1] === text[start + j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
      }
      [prev, cur] = [cur, prev];
    }
    return prev[end - start];
  }
}

function lcsLength(a: Seq, b: Seq): number {
  return a.length <= b.length ? new LcsPattern(a).lcs(b) : new LcsPattern(b).lcs(a);
}

function indelDistance(a: Seq, b: Seq): number {
  return a.length + b.length - 2 * lcsLength(a, b);
}

function normalizedSimilarityFromLcs(lenA: number, lenB: number, lcs: number): number {
  const maximum = lenA + lenB;
  const normDist = maximum ? (maximum - 2 * lcs) / maximum : 0;
  return 1.0 - normDist;
}

function indelNormalizedSimilarity(a: Seq, b: Seq): number {
  return normalizedSimilarityFromLcs(a.length, b.length, lcsLength(a, b));
}

function normDistance(dist: number, lensum: number): number {
  return lensum ? 100 - 100 * dist / lensum : 100;
}

function ratio(a: Seq, b: Seq): number {
  return indelNormalizedSimilarity(a, b) * 100;
}

function partialRatioImpl(s1: Seq, s2: Seq): number {
  const s1CharSet = new Set(s1);
  const pattern = new LcsPattern(s1);
  const len1 = s1.length;
  const len2 = s2.length;
  const windowSimilarity = (start: number, end: number) =>
    normalizedSimilarityFromLcs(len1, end - start, pattern.lcs(s2, start, end));
  let score = 0;

  for (let i = 1; i < len1; i++) {
    if (!s1CharSet.has(s2[i - 1])) continue;
    const lsRatio = windowSimilarity(0, i);
    if (lsRatio > score) {
      score = lsRatio;
      if (score === 1) return 100;
    }
  }

  for (let i = 0; i < len2 - len1; i++) {
    if (!s1CharSet.has(s2[i + len1 - 1])) continue;
    const lsRatio = windowSimilarity(i, i + len1);
    if (lsRatio > score) {
      score = lsRatio;
      if (score === 1) return 100;
    }
  }

  for (let i = Math.max(0, len2 - len1); i < len2; i++) {
    if (!s1CharSet.has(s2[i])) continue;
    const lsRatio = windowSimilarity(i, len2);
    if (lsRatio > score) {
      score = lsRatio;
      if (score === 1) return 100;
    }
  }

  return score * 100;
}

function partialRatio(s1: Seq, s2: Seq): number {
  if (!s1.length && !s2.length) return 100;
  const len1 = s1.length;
  const len2 = s2.length;
  const [shorter, longer] = len1 <= len2 ? [s1, s2] : [s2, s1];

  let res = partialRatioImpl(shorter, longer);
  if (res !== 100 && len1 === len2) {
    const res2 = partialRatioImpl(longer, shorter);
    if (res2 > res) res = res2;
  }
  return res;
}

function compareSeq(a: Seq, b: Seq): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

const SPACE = 32;

function splitSequence(s: Seq): string[] {
  // str.split(): tokens keyed as strings so they can live in Sets
  return String.fromCodePoint(...s).split(/\s+/u).filter(Boolean);
}

function joinSorted(tokens: Iterable<string>): Seq {
  const seqs = Array.from(tokens, toSeq).sort(compareSeq);
  const joined: Seq = [];
  seqs.forEach((t, i) => {
    if (i) joined.push(SPACE);
    joined.push(...t);
  });
  return joined;
}

function tokenSortRatio(s1: Seq, s2: Seq): number {
  return ratio(joinSorted(splitSequence(s1)), joinSorted(splitSequence(s2)));
}

function tokenSetRatio(s1: Seq, s2: Seq): number {
  const tokensA = new Set(splitSequence(s1));
  const tokensB = new Set(splitSequence(s2));
  if (!tokensA.size || !tokensB.size) return 0;

  const intersect = Array.from(tokensA).filter((t) => tokensB.has(t));
  const diffAB = Array.from(tokensA).filter((t) => !tokensB.has(t));
  const diffBA = Array.from(tokensB).filter((t) => !tokensA.has(t));

  if (intersect.length && (!diffAB.length || !diffBA.length)) return 100;

  const diffABJoined = joinSorted(diffAB);
  const diffBAJoined = joinSorted(diffBA);
  const abLen = diffABJoined.length;
  const baLen = diffBAJoined.length;
  const sectLen = joinSorted(intersect).length;

  const sectABLen = sectLen + (sectLen !== 0 ? 1 : 0) + abLen;
  const sectBALen = sectLen + (sectLen !== 0 ? 1 : 0) + baLen;

  const dist = indelDistance(diffABJoined, diffBAJoined);
  const result = normDistance(dist, sectABLen + sectBALen);

  if (!sectLen) return result;

  const sectABRatio = normDistance((sectLen !== 0 ? 1 : 0) + abLen, sectLen + sectABLen);
  const sectBARatio = normDistance((sectLen !== 0 ? 1 : 0) + baLen, sectLen + sectBALen);
  return Math.max(result, sectABRatio, sectBARatio);
}

function tokenRatio(s1: Seq, s2: Seq): number {
  return Math.max(tokenSetRatio(s1, s2), tokenSortRatio(s1, s2));
}

function partialTokenRatio(s1: Seq, s2: Seq): number {
  const tokensSplitA = splitSequence(s1);
  const tokensSplitB = splitSequence(s2);
  const tokensA = new Set(tokensSplitA);
  const tokensB = new Set(tokensSplitB);

  if (Array.from(tokensA).some((t) => tokensB.has(t))) return 100;

  const diffAB = Array.from(tokensA).filter((t) => !tokensB.has(t));
  const diffBA = Array.from(tokensB).filter((t) => !tokensA.has(t));

  const result = partialRatio(joinSorted(tokensSplitA), joinSorted(tokensSplitB));

  if (tokensSplitA.length === diffAB.length && tokensSplitB.length === diffBA.length) return result;

  return Math.max(result, partialRatio(joinSorted(diffAB), joinSorted(diffBA)));
}

export function WRatio(a: string, b: string): number {
  const s1 = toSeq(a);
  const s2 = toSeq(b);
  const UNBASE_SCALE = 0.95;
  if (!s1.length || !s2.length) return 0;

  const len1 = s1.length;
  const len2 = s2.length;
  const lenRatio = len1 > len2 ? len1 / len2 : len2 / len1;

  let endRatio = ratio(s1, s2);
  if (lenRatio < 1.5) {
    return Math.max(endRatio, tokenRatio(s1, s2) * UNBASE_SCALE);
  }

  const PARTIAL_SCALE = lenRatio <= 8.0 ? 0.9 : 0.6;
  endRatio = Math.max(endRatio, partialRatio(s1, s2) * PARTIAL_SCALE);
  return Math.max(endRatio, partialTokenRatio(s1, s2) * UNBASE_SCALE * PARTIAL_SCALE);
}

/** rapidfuzz.utils.default_process: non-alphanumerics -> space, lower-case, trim. */
function defaultProcess(s: string): string {
  return s.replace(/[^\p{L}\p{N}]/gu, ' ').toLowerCase().trim();
}

/** thefuzz.utils.full_process. `force_ascii` drops code points 128-255 (thefuzz's "ascii dammit" table). */
export function fullProcess(s: string, forceAscii = false): string {
  if (forceAscii) s = s.replace(/[\u0080-ÿ]/g, '');
  return defaultProcess(s);
}

/** Python round(): half to even. */
function pyRound(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

const processedChoices = new Map<string, string>();

/** thefuzz.process.extractOne(query, choices) -> [choice, int score] | null */
export function extractOne(query: string, choices: string[]): [string, number] | null {
  // thefuzz pre-processes the query with full_process, then rapidfuzz applies the
  // force_ascii variant to both query and choices.
  const processedQuery = fullProcess(fullProcess(query), true);
  let best: [string, number] | null = null;
  for (const choice of choices) {
    let processed = processedChoices.get(choice);
    if (processed === undefined) {
      processed = fullProcess(choice, true);
      processedChoices.set(choice, processed);
    }
    const score = WRatio(processedQuery, processed);
    if (best === null || score > best[1]) {
      best = [choice, score];
      if (score === 100) break;
    }
  }
  return best ? [best[0], pyRound(best[1])] : null;
}
