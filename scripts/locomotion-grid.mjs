// Locate the authored grid by transparent gutters. Unlike global connected
// components, this keeps separate poses when a stray edge pixel touches the
// neighboring sprite. No pixels are invented or poses substituted.
export function directionalRects(source, count = 8, rowCount = count) {
  const alpha = 220;
  const cuts = (axis) => {
    const length = axis === "x" ? source.width : source.height;
    const histogram = new Uint32Array(length);
    for (let y = 0; y < source.height; y++)
      for (let x = 0; x < source.width; x++)
        if (source.data[(y * source.width + x) * 4 + 3] >= alpha)
          histogram[axis === "x" ? x : y]++;
    const divisions = axis === "x" ? count : rowCount;
    const pitch = length / divisions,
      result = [0];
    for (let i = 1; i < divisions; i++) {
      const nominal = i * pitch;
      let best = Math.round(nominal),
        score = Infinity;
      for (
        let at = Math.ceil(nominal - pitch * 0.24);
        at <= Math.floor(nominal + pitch * 0.24);
        at++
      ) {
        const ink = (histogram[at - 1] + histogram[at] + histogram[at + 1]) / 3;
        const cost = ink + Math.abs(at - nominal) * 0.15;
        if (cost < score) {
          score = cost;
          best = at;
        }
      }
      result.push(best);
    }
    result.push(length);
    return result;
  };
  const xs = cuts("x"),
    ys = cuts("y");
  return Array.from({ length: rowCount }, (_, row) =>
    Array.from({ length: count }, (_, col) => {
      const x0 = xs[col],
        x1 = xs[col + 1],
        y0 = ys[row],
        y1 = ys[row + 1],
        w = x1 - x0,
        h = y1 - y0;
      const seen = new Uint8Array(w * h),
        parts = [];
      for (let py = 0; py < h; py++)
        for (let px = 0; px < w; px++) {
          const start = py * w + px;
          if (
            seen[start] ||
            source.data[((py + y0) * source.width + px + x0) * 4 + 3] < alpha
          )
            continue;
          const queue = [start],
            part = { area: 0, minX: x1, minY: y1, maxX: x0, maxY: y0 };
          seen[start] = 1;
          for (let n = 0; n < queue.length; n++) {
            const at = queue[n],
              x = at % w,
              y = Math.floor(at / w);
            part.area++;
            part.minX = Math.min(part.minX, x + x0);
            part.maxX = Math.max(part.maxX, x + x0);
            part.minY = Math.min(part.minY, y + y0);
            part.maxY = Math.max(part.maxY, y + y0);
            for (const [dx, dy] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]) {
              const nx = x + dx,
                ny = y + dy,
                next = ny * w + nx;
              if (
                nx < 0 ||
                ny < 0 ||
                nx >= w ||
                ny >= h ||
                seen[next] ||
                source.data[((ny + y0) * source.width + nx + x0) * 4 + 3] <
                  alpha
              )
                continue;
              seen[next] = 1;
              queue.push(next);
            }
          }
          parts.push(part);
        }
      parts.sort((a, b) => b.area - a.area);
      if (!parts.length || parts[0].area < w * h * 0.08)
        throw Error("Missing complete actor at " + row + ":" + col);
      const keep = parts.filter(
        (p) => p.area >= Math.max(8, parts[0].area * 0.035),
      );
      const sx = Math.min(...keep.map((p) => p.minX)),
        sy = Math.min(...keep.map((p) => p.minY));
      return {
        sx,
        sy,
        sw: Math.max(...keep.map((p) => p.maxX)) - sx + 1,
        sh: Math.max(...keep.map((p) => p.maxY)) - sy + 1,
        components: keep,
      };
    }),
  );
}
