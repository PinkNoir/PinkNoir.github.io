// Generates the favicon sets from the brand logo (public/img/pink_noir.svg).
//
//   npm run favicon
//
// Two marks, both plum on brand rose (colours from the site theme, src/main.css):
//
//   "p"       the logo's own "P" — readable down to 16px, used by the site.
//   "needle"  the needle and its thread — the more distinctive mark, but its strokes are
//             sub-pixel at favicon sizes, so each raster size is drawn with a slight
//             outline: heavier at 16px where it would otherwise dissolve, barely there
//             at 180px where the original weight reads fine.
//
// Outputs (all committed, so CI never needs a rasteriser):
//   public/favicon.svg / .ico / apple-touch-icon.png                  the "P" set (linked in index.html)
//   public/favicon-needle.svg / .ico / apple-touch-icon-needle.png    the needle set
//
// Requires Inkscape for rasterising: brew install --cask inkscape

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROSE = "#f9b7b2"; // --color-base-100
const PLUM = "#391628"; // --color-base-content
const LOGO = "public/img/pink_noir.svg";
const ICO_SIZES = [16, 32, 48];
const APPLE_SIZE = 180;

const logo = readFileSync(LOGO, "utf8");
const pick = (re, what) => {
  const m = logo.match(re);
  if (!m) throw new Error(`no ${what} found in ${LOGO}`);
  return m[0];
};

// Bounding boxes are in the logo's coordinate system with its group transform applied,
// as reported by `inkscape --query-all`.
const MARKS = {
  p: {
    glyph: pick(/<path[^>]*aria-label="P"\/>/, "P glyph"),
    bbox: { x: 0.0018, y: 20.3348, w: 35.4522, h: 44.7962 },
    padding: 1.42,
    stroke: () => 0,
    svg: "public/favicon.svg",
    ico: "public/favicon.ico",
    apple: "public/apple-touch-icon.png",
  },
  needle: {
    glyph: pick(/<path transform="matrix\(1\.3333 0 0 -1\.3333 142\.85 83\.036\)"[^>]*\/>/, "needle path"),
    bbox: { x: 39.7939, y: 6.03994, w: 121.46, h: 171.655 },
    padding: 1.1,
    // Optical sizing: thicken the thin parts only as much as the target size needs.
    stroke: (size) => (size <= 16 ? 2.8 : size <= 32 ? 2 : size <= 48 ? 1.4 : 1.2),
    svgStroke: 1.4,
    svg: "public/favicon-needle.svg",
    ico: "public/favicon-needle.ico",
    apple: "public/apple-touch-icon-needle.png",
  },
};

const n = (v) => Number(v.toFixed(3));

function markSvg(mark, stroke) {
  const { bbox, padding, glyph } = mark;
  const side = bbox.h * padding;
  const x0 = bbox.x + bbox.w / 2 - side / 2;
  const y0 = bbox.y + bbox.h / 2 - side / 2;
  const outline = stroke
    ? ` stroke="${PLUM}" stroke-width="${stroke}" stroke-linejoin="round"`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x0)} ${n(y0)} ${n(side)} ${n(side)}" width="512" height="512" role="img" aria-label="Pink Noir">
  <rect x="${n(x0)}" y="${n(y0)}" width="${n(side)}" height="${n(side)}" fill="${ROSE}"/>
  <g fill="${PLUM}"${outline} transform="translate(-12.363 -23.05)">${glyph}</g>
</svg>
`;
}

// ICO with PNG payloads: 6-byte header, a 16-byte directory entry per image, then the PNGs.
function ico(images, sizes) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + 16 * images.length;
  const entries = images.map((data, i) => {
    const size = sizes[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette colours
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images]);
}

const tmp = mkdtempSync(join(tmpdir(), "pn-favicon-"));

function raster(mark, size) {
  const src = join(tmp, "src.svg");
  const out = join(tmp, `${size}.png`);
  writeFileSync(src, markSvg(mark, mark.stroke(size)));
  execFileSync("inkscape", [
    "--export-type=png",
    `--export-filename=${out}`,
    "-w", String(size),
    "-h", String(size),
    src,
  ], { stdio: "ignore" });
  return readFileSync(out);
}

for (const [name, mark] of Object.entries(MARKS)) {
  writeFileSync(mark.svg, markSvg(mark, mark.svgStroke ?? 0));
  writeFileSync(mark.ico, ico(ICO_SIZES.map((s) => raster(mark, s)), ICO_SIZES));
  writeFileSync(mark.apple, raster(mark, APPLE_SIZE));
  console.log("%s: %s, %s (%s), %s", name, mark.svg, mark.ico, ICO_SIZES.join("/"), mark.apple);
}

rmSync(tmp, { recursive: true, force: true });
