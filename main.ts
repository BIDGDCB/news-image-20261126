// news-image-20261126 — one-image summary of the world news of Thursday 26 November 2026.
// Written fresh in-session. Draws a 1024x1024 newspaper-style front page with six stories
// using only the Node standard library (zlib for PNG encoding, fs for output).
// No network, no randomness: both runs write identical bytes.

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// Pixel buffer (RGB, 8 bit per channel)
// ---------------------------------------------------------------------------
const px = new Uint8Array(W * H * 3);

function fillAll(r: number, g: number, b: number): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = r;
    px[i * 3 + 1] = g;
    px[i * 3 + 2] = b;
  }
}

function setPixel(x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
}

function fillRect(x: number, y: number, w: number, h: number, c: [number, number, number]): void {
  const [r, g, b] = c;
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, r, g, b);
  }
}

function fillCircle(cx: number, cy: number, rad: number, c: [number, number, number]): void {
  const [r, g, b] = c;
  for (let yy = cy - rad; yy <= cy + rad; yy++) {
    for (let xx = cx - rad; xx <= cx + rad; xx++) {
      if ((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) <= rad * rad) setPixel(xx, yy, r, g, b);
    }
  }
}

function ring(cx: number, cy: number, rad: number, thick: number, c: [number, number, number]): void {
  const [r, g, b] = c;
  for (let yy = cy - rad - thick; yy <= cy + rad + thick; yy++) {
    for (let xx = cx - rad - thick; xx <= cx + rad + thick; xx++) {
      const d = Math.sqrt((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy));
      if (Math.abs(d - rad) <= thick / 2) setPixel(xx, yy, r, g, b);
    }
  }
}

// Filled triangle (scanline).
function fillTri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, c: [number, number, number]): void {
  const [r, g, b] = c;
  const minY = Math.min(y1, y2, y3);
  const maxY = Math.max(y1, y2, y3);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: Array<[number, number, number, number]> = [
      [x1, y1, x2, y2],
      [x2, y2, x3, y3],
      [x3, y3, x1, y1],
    ];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    if (xs.length >= 2) {
      const lo = Math.min(...xs);
      const hi = Math.max(...xs);
      for (let x = Math.ceil(lo); x <= Math.floor(hi); x++) setPixel(x, y, r, g, b);
    }
  }
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font (uppercase, digits, punctuation). '#' = ink.
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "\u00b7": ["00000", "00000", "01100", "01100", "00000", "00000", "00000"],
};

const CHAR_W = 6; // 5 px glyph + 1 px gap
const CHAR_H = 7;

function textWidth(s: string, scale: number): number {
  return s.length * CHAR_W * scale - scale;
}

function drawChar(ch: string, x: number, y: number, scale: number, c: [number, number, number]): void {
  const glyph = FONT[ch] ?? FONT["?"];
  for (let row = 0; row < CHAR_H; row++) {
    for (let col = 0; col < 5; col++) {
      if (glyph[row][col] === "1") {
        fillRect(x + col * scale, y + row * scale, scale, scale, c);
      }
    }
  }
}

function drawText(s: string, x: number, y: number, scale: number, c: [number, number, number]): void {
  for (let i = 0; i < s.length; i++) {
    drawChar(s[i], x + i * CHAR_W * scale, y, scale, c);
  }
}

function drawTextCentered(s: string, cx: number, y: number, scale: number, c: [number, number, number]): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

// Word-wrap: returns lines that fit within maxWidth px at the given scale.
function wrap(text: string, maxWidth: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxWidth) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const PAPER: [number, number, number] = [247, 243, 234];
const NAVY: [number, number, number] = [18, 38, 63];
const GOLD: [number, number, number] = [201, 162, 39];
const INK: [number, number, number] = [24, 28, 36];
const GREY: [number, number, number] = [110, 116, 126];
const WHITE: [number, number, number] = [255, 255, 255];
const CARD: [number, number, number] = [255, 255, 255];

// ---------------------------------------------------------------------------
// The six stories of 26 November 2026
// ---------------------------------------------------------------------------
interface Story {
  tag: string;
  color: [number, number, number];
  headline: string;
  body: string;
  source: string;
  icon: string;
}

const STORIES: Story[] = [
  {
    tag: "TRADE",
    color: [179, 64, 42],
    headline: "US HITS 14 PARTNERS WITH NEW TARIFFS",
    body: "Washington proposes duties on 14 economies, China facing an extra 20 percent, to fight excess factory capacity.",
    source: "REUTERS",
    icon: "bars",
  },
  {
    tag: "MIDDLE EAST",
    color: [217, 123, 41],
    headline: "HOUTHIS CLAIM STRIKE ON SAUDI REFINERY",
    body: "Yemen's Houthis say they hit Ras Tanura, the kingdom's biggest refinery, and Red Sea ports. Oil prices jump.",
    source: "REUTERS",
    icon: "flame",
  },
  {
    tag: "SPACE",
    color: [31, 111, 178],
    headline: "SPACEX CLEARED FOR 1M ORBITAL SATELLITES",
    body: "The FCC authorises SpaceX to launch up to one million satellites to build data centres in orbit for AI.",
    source: "FCC / TIMES OF INDIA",
    icon: "satellite",
  },
  {
    tag: "SECURITY",
    color: [106, 76, 147],
    headline: "KIM URGES WIDER TACTICAL NUCLEAR DEPLOYMENT",
    body: "North Korea's leader calls for tactical nuclear weapons to be deployed across more domains, KCNA reports.",
    source: "KCNA",
    icon: "atom",
  },
  {
    tag: "SPACE",
    color: [14, 124, 123],
    headline: "FIRST PAKISTANI ASTRONAUT REACHES TIANGONG",
    body: "Muhammad Zeeshan Ali boards China's Tiangong station aboard Shenzhou-24, the first foreigner to do so.",
    source: "ONE TURN / REUTERS",
    icon: "helmet",
  },
  {
    tag: "EUROPE",
    color: [78, 122, 46],
    headline: "EU LEADERS SPLIT OVER 45BN UKRAINE LOAN",
    body: "Leaders meet in Brussels divided over a 45 billion euro loan for Ukraine and the bloc's 2028-2034 budget.",
    source: "DAILY SUMMARY OF WORLD",
    icon: "stars",
  },
];

// ---------------------------------------------------------------------------
// Icons (drawn in an 88x88 box at x, y)
// ---------------------------------------------------------------------------
function drawIcon(kind: string, x: number, y: number, c: [number, number, number]): void {
  const cx = x + 44;
  const cy = y + 44;
  if (kind === "bars") {
    // Rising bar chart.
    fillRect(x + 10, y + 58, 16, 22, c);
    fillRect(x + 32, y + 44, 16, 36, c);
    fillRect(x + 54, y + 28, 16, 52, c);
    fillRect(x + 6, y + 78, 72, 4, INK);
    drawText("%", x + 56, y + 2, 2, c);
  } else if (kind === "flame") {
    // Oil drop / flame.
    fillTri(cx, y + 4, cx - 20, y + 48, cx + 20, y + 48, c);
    fillCircle(cx, y + 52, 22, c);
    fillCircle(cx, y + 58, 10, WHITE);
    fillRect(x + 4, y + 80, 80, 4, INK);
  } else if (kind === "satellite") {
    // Satellite body + solar panels.
    fillRect(x + 6, y + 34, 20, 20, c);
    fillRect(x + 62, y + 34, 20, 20, c);
    fillRect(x + 30, y + 30, 28, 28, c);
    fillRect(x + 40, y + 14, 8, 16, c);
    fillCircle(x + 44, y + 12, 5, GOLD);
    fillRect(x + 30, y + 62, 28, 4, INK);
  } else if (kind === "atom") {
    // Radiation trefoil: centre dot + three blades.
    fillCircle(cx, cy, 8, c);
    fillCircle(cx, cy - 26, 13, c);
    fillCircle(cx - 23, cy + 15, 13, c);
    fillCircle(cx + 23, cy + 15, 13, c);
    ring(cx, cy, 34, 4, c);
  } else if (kind === "helmet") {
    // Astronaut helmet.
    ring(cx, cy - 4, 30, 6, c);
    fillCircle(cx, cy - 4, 20, c);
    fillRect(cx - 12, cy + 26, 24, 22, c);
    fillRect(cx - 26, cy + 26, 10, 22, c);
    fillRect(cx + 16, cy + 26, 10, 22, c);
  } else if (kind === "stars") {
    // Circle of stars (EU flag motif).
    ring(cx, cy, 32, 4, c);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const sx = Math.round(cx + Math.cos(a) * 20);
      const sy = Math.round(cy + Math.sin(a) * 20);
      fillRect(sx - 3, sy - 3, 6, 6, GOLD);
    }
  }
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
function drawCard(s: Story, x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, CARD);
  // Coloured top bar + tag.
  fillRect(x, y, w, 8, s.color);
  drawText(s.tag, x + 16, y + 20, 2, s.color);
  // Icon.
  drawIcon(s.icon, x + 14, y + 46, s.color);
  // Headline beside the icon (up to 3 lines, scale 3).
  const headLines = wrap(s.headline, w - 116 - 16, 3).slice(0, 3);
  headLines.forEach((ln, i) => {
    drawText(ln, x + 116, y + 48 + i * 24, 3, INK);
  });
  // Body below (scale 2, up to 4 lines). The bitmap font is uppercase-only,
  // so the body is uppercased before drawing.
  const bodyLines = wrap(s.body.toUpperCase(), w - 32, 2).slice(0, 4);
  bodyLines.forEach((ln, i) => {
    drawText(ln, x + 16, y + 148 + i * 20, 2, [52, 58, 68]);
  });
  // Source line at the bottom.
  drawText("SOURCE: " + s.source, x + 16, y + h - 30, 2, GREY);
}

function draw(): void {
  fillAll(...PAPER);

  // Header band.
  fillRect(0, 0, W, 118, NAVY);
  fillRect(0, 118, W, 6, GOLD);
  // Small globe mark.
  ring(64, 56, 30, 5, GOLD);
  fillRect(34, 56, 60, 4, GOLD);
  fillRect(64, 26, 4, 60, GOLD);
  drawText("THE WORLD IN ONE PICTURE", 116, 22, 2, GOLD);
  drawText("THURSDAY 26 NOVEMBER 2026", 116, 48, 4, WHITE);
  drawText("SIX STORIES THAT DEFINED THE DAY", 116, 88, 2, [190, 198, 210]);

  // Six cards: 2 columns x 3 rows.
  const cardW = 496;
  const cardH = 276;
  const xs = [8, 520];
  const ys = [136, 424, 712];
  for (let i = 0; i < 6; i++) {
    drawCard(STORIES[i], xs[i % 2], ys[Math.floor(i / 2)], cardW, cardH);
  }

  // Footer.
  drawTextCentered(
    "SOURCES: REUTERS - KCNA - US FCC - DAILY SUMMARY OF WORLD - ONE TURN",
    W / 2,
    1000,
    2,
    GREY,
  );
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder (RGB, 8-bit, no filtering)
// ---------------------------------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
draw();
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
mkdirSync(outDir, { recursive: true });
const png = encodePNG();
writeFileSync(`${outDir}/entry.png`, png);
console.log(`wrote ${outDir}/entry.png (${png.length} bytes, ${W}x${H})`);
