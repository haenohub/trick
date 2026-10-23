import { inflateSync } from "node:zlib";

// Small decoder for the 8-bit RGBA PNGs emitted by the native asset packer.
export function rgbaPixels(png) {
  const width = png.readUInt32BE(16),
    height = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 6) throw Error("Expected 8-bit RGBA PNG");
  const idat = [];
  for (let at = 8; at < png.length; ) {
    const n = png.readUInt32BE(at);
    if (png.toString("ascii", at + 4, at + 8) === "IDAT")
      idat.push(png.subarray(at + 8, at + 8 + n));
    at += n + 12;
  }
  const raw = inflateSync(Buffer.concat(idat)),
    stride = width * 4,
    out = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c,
      x = Math.abs(p - a),
      y = Math.abs(p - b),
      z = Math.abs(p - c);
    return x <= y && x <= z ? a : y <= z ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x,
        a = x >= 4 ? out[at - 4] : 0,
        b = y ? out[at - stride] : 0,
        c = y && x >= 4 ? out[at - stride - 4] : 0;
      const prediction =
        filter === 0
          ? 0
          : filter === 1
            ? a
            : filter === 2
              ? b
              : filter === 3
                ? Math.floor((a + b) / 2)
                : filter === 4
                  ? paeth(a, b, c)
                  : NaN;
      if (!Number.isFinite(prediction)) throw Error("Unsupported PNG filter");
      out[at] = (raw[y * (stride + 1) + x + 1] + prediction) & 255;
    }
  }
  return { width, height, pixels: out };
}
