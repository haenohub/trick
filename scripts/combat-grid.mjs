// Generated sheets can give tall actors more vertical space than small ones.
// Find real transparent row seams rather than cutting an assumed equal grid.
export function combatRowCuts(src, count = 8) {
  const hist = new Float64Array(src.height);
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++)
      if (src.data[(y * src.width + x) * 4 + 3] >= 220) hist[y]++;
  const smooth = hist.map(
      (_, i) =>
        (hist[Math.max(0, i - 1)] +
          hist[i] +
          hist[Math.min(src.height - 1, i + 1)]) /
        3,
    ),
    max = Math.max(...smooth),
    candidates = [0];
  let start = -1;
  for (let y = 1; y < src.height; y++) {
    if (smooth[y] <= max * 0.1) {
      if (start < 0) start = y;
    } else if (start >= 0) {
      candidates.push(Math.round((start + y - 1) / 2));
      start = -1;
    }
  }
  if (start >= 0) candidates.push(Math.round((start + src.height - 1) / 2));
  candidates.push(src.height);
  const unique = [...new Set(candidates)].sort((a, b) => a - b),
    pitch = src.height / count,
    dp = Array.from({ length: count + 1 }, () => new Map());
  dp[0].set(0, { cost: 0, path: [0] });
  for (let n = 1; n <= count; n++)
    for (const end of unique) {
      if ((n === count) !== (end === src.height)) continue;
      let best = null;
      for (const [prev, value] of dp[n - 1]) {
        const length = end - prev;
        if (length < pitch * 0.4 || length > pitch * 1.85) continue;
        const ink = end === src.height ? 0 : smooth[end] / max;
        const cost =
          value.cost + ink * 100 + ((length - pitch) / pitch) ** 2 * 0.1;
        if (!best || cost < best.cost)
          best = { cost, path: [...value.path, end] };
      }
      if (best) dp[n].set(end, best);
    }
  const result = dp[count].get(src.height);
  if (!result) throw Error("Cannot isolate all" + count + " authored rows");
  return result.path;
}
