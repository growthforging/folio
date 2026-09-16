/** Subsequence fuzzy match. Higher is better; null means no match. */
export function fuzzyScore(query: string, text: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let prev = -2;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      score += 1;
      if (prev === i - 1) score += 2;
      if (i === 0 || /[\s\-_./(]/.test(t[i - 1])) score += 3;
      prev = i;
      qi++;
    }
  }
  if (qi < q.length) return null;
  const idx = t.indexOf(q);
  if (idx >= 0) score += 6 + (idx === 0 ? 4 : 0);
  return score - t.length * 0.01;
}
