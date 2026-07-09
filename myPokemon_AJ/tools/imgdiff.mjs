#!/usr/bin/env node
// imgdiff.mjs — 의존성 0 PNG 픽셀 대조 도구 (에이전트 "눈" 검증용)
// 사용: node imgdiff.mjs A.png B.png [out_composite.png] [tolerance=10]
// 출력: JSON(크기·평균밝기·diff%) + 나란히 비교 PNG(A | B | 차이 히트맵)
// 목적: "됐다/똑같다" 단정 전에 실제 픽셀로 대조. 캡처 유효성(밝기)도 함께 판정.
import fs from "fs";
import zlib from "zlib";

function readPNG(path) {
  const buf = fs.readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(path + ": PNG 아님");
  let pos = 8, w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  let palette = null, trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (interlace !== 0) throw new Error(path + ": interlaced PNG 미지원");
  if (bitDepth !== 8) throw new Error(path + `: bitDepth ${bitDepth} 미지원(8만)`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (channels === undefined) throw new Error(path + ": colorType " + colorType + " 미지원");
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(w * h * 4); // RGBA로 정규화
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0; // left
      const b = prev[i]; // up
      const c = i >= channels ? prev[i - channels] : 0; // up-left
      if (f === 1) line[i] = (line[i] + a) & 255;
      else if (f === 2) line[i] = (line[i] + b) & 255;
      else if (f === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * channels;
      if (colorType === 2) { out[o] = line[s]; out[o+1] = line[s+1]; out[o+2] = line[s+2]; out[o+3] = 255; }
      else if (colorType === 6) { out[o] = line[s]; out[o+1] = line[s+1]; out[o+2] = line[s+2]; out[o+3] = line[s+3]; }
      else if (colorType === 0) { out[o] = out[o+1] = out[o+2] = line[s]; out[o+3] = 255; }
      else if (colorType === 4) { out[o] = out[o+1] = out[o+2] = line[s]; out[o+3] = line[s+1]; }
      else if (colorType === 3) {
        const pi = line[s] * 3;
        out[o] = palette[pi]; out[o+1] = palette[pi+1]; out[o+2] = palette[pi+2];
        out[o+3] = trns && line[s] < trns.length ? trns[line[s]] : 255;
      }
    }
    prev = line;
  }
  return { width: w, height: h, data: out };
}

function writePNG(path, w, h, rgba) {
  const stride = w * 4, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const chunks = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
  const chunk = (type, data) => {
    const b = Buffer.alloc(12 + data.length);
    b.writeUInt32BE(data.length, 0); b.write(type, 4);
    data.copy(b, 8);
    b.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])), 8 + data.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  chunks.push(chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0)));
  fs.writeFileSync(path, Buffer.concat(chunks));
}
let CRC_T;
function crc32(buf) {
  if (!CRC_T) { CRC_T = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c; } }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

const [, , pa, pb, outPath, tolArg] = process.argv;
if (!pa || !pb) { console.error("사용: node imgdiff.mjs A.png B.png [out.png] [tolerance]"); process.exit(1); }
const tol = Number(tolArg ?? 10);
const A = readPNG(pa), B = readPNG(pb);
const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
const avg = (img) => { let s = 0; for (let i = 0; i < img.data.length; i += 4) s += (img.data[i] + img.data[i+1] + img.data[i+2]) / 3; return s / (img.data.length / 4); };
let diff = 0;
const heat = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const ia = (y * A.width + x) * 4, ib = (y * B.width + x) * 4, io = (y * w + x) * 4;
  const d = Math.max(Math.abs(A.data[ia] - B.data[ib]), Math.abs(A.data[ia+1] - B.data[ib+1]), Math.abs(A.data[ia+2] - B.data[ib+2]), Math.abs(A.data[ia+3] - B.data[ib+3]));
  const bad = d > tol;
  if (bad) diff++;
  heat[io] = bad ? 255 : A.data[ia] >> 2; heat[io+1] = bad ? 0 : A.data[ia+1] >> 2; heat[io+2] = bad ? 0 : A.data[ia+2] >> 2; heat[io+3] = 255;
}
const result = {
  A: { file: pa, w: A.width, h: A.height, avgBrightness: +avg(A).toFixed(1) },
  B: { file: pb, w: B.width, h: B.height, avgBrightness: +avg(B).toFixed(1) },
  sizeMatch: A.width === B.width && A.height === B.height,
  comparedArea: `${w}x${h}`, tolerance: tol,
  diffPct: +((diff / (w * h)) * 100).toFixed(2),
  captureValid: avg(A) >= 15 && avg(B) >= 15, // 검은/무효 캡처 감지
};
if (outPath) { // 나란히: A | B | 히트맵(빨강=차이)
  const H = Math.max(A.height, B.height, h), W = A.width + B.width + w, comp = Buffer.alloc(W * H * 4);
  const blit = (img, ox, ww, hh) => { for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) { const s = (y * img.w + x) * 4, d = (y * W + ox + x) * 4; comp[d] = img.d[s]; comp[d+1] = img.d[s+1]; comp[d+2] = img.d[s+2]; comp[d+3] = img.d[s+3]; } };
  blit({ d: A.data, w: A.width }, 0, A.width, A.height);
  blit({ d: B.data, w: B.width }, A.width, B.width, B.height);
  blit({ d: heat, w }, A.width + B.width, w, h);
  writePNG(outPath, W, H, comp);
  result.composite = outPath;
}
console.log(JSON.stringify(result, null, 2));
