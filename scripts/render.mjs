// Renders assets/hero-{dark,light}.svg: the tagline replays at my Monkeytype personal best.
// Usage: node scripts/render.mjs   (Node 18+, no dependencies)
import { writeFileSync } from "node:fs";

const USER = "Kyziq";
const NAME = "Haziq";
const LINE = "I build AI products end to end, from UI to GPU.";
const TEST = "60"; // seconds; the standard length, so the number reads as sustained speed

const res = await fetch(`https://api.monkeytype.com/users/${USER}/profile`);
if (!res.ok) throw new Error(`Monkeytype API ${res.status}`);
const runs = (await res.json()).data.personalBests.time[TEST];
const wpm = Math.round(Math.max(...runs.map((r) => r.wpm)));
if (!(wpm > 0)) throw new Error(`no ${TEST}s personal best found`);

const msPerChar = 60000 / (wpm * 5); // Monkeytype counts five characters as one word
const typingMs = Math.round(LINE.length * msPerChar);
const startMs = 600;

const W = 340; // viewBox units; README shows it at 420px, about 1:1 on a phone
const H = 158;
const X = 2;
const FONT = 16;
const ADV = FONT * 0.6; // fixed advance per glyph, so the caret position does not depend on the font
const MAX = 33; // characters per row
const ROW_Y = [86, 112];

const themes = {
  dark: { fg: "#e6edf3", dim: "#7d8590", muted: "#9198a1", caret: "#e2b714" },
  light: { fg: "#1f2328", dim: "#6e7781", muted: "#59636e", caret: "#9a6700" },
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Greedy word wrap; the space that ends a row is typed but not drawn.
const rows = [""];
for (const word of LINE.split(" ")) {
  const cur = rows.at(-1);
  if (cur && (cur + " " + word).length > MAX) rows.push(word);
  else rows[rows.length - 1] = cur ? cur + " " + word : word;
}
if (rows.length > ROW_Y.length) throw new Error("LINE is too long for two rows");

// One stop per keystroke: where the caret sits after it.
const stops = [];
let k = 0;
rows.forEach((row, r) => {
  [...row].forEach((ch, c) => stops.push({ ch, r, c, delay: Math.round(startMs + k++ * msPerChar) }));
  if (r < rows.length - 1) k++; // the wrapping space
});

function svg(t) {
  const text = rows
    .map((_, r) =>
      `<text class="line" y="${ROW_Y[r]}">` +
      stops
        .filter((s) => s.r === r)
        .map((s) => `<tspan x="${(X + s.c * ADV).toFixed(1)}" style="animation-delay:${s.delay}ms">${esc(s.ch)}</tspan>`)
        .join("") +
      "</text>",
    )
    .join("\n");

  const pos = (s) => `translate(${((s.c + 1) * ADV).toFixed(1)}px,${ROW_Y[s.r] - ROW_Y[0]}px)`;
  const end = pos(stops.at(-1));
  const frames = stops
    .map((s) => `${(((s.delay - startMs) / typingMs) * 100).toFixed(2)}%{transform:${pos(s)}}`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
<title id="t">${NAME}. ${LINE} Typed at ${wpm} wpm, my Monkeytype ${TEST} second best.</title>
<style>
.name{font:600 40px ui-sans-serif,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;fill:${t.fg};letter-spacing:-1px}
.line{font:400 ${FONT}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;fill:${t.dim}}
.line tspan{animation:typed 1ms steps(1) forwards}
.note{font:400 12px ui-sans-serif,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;fill:${t.muted}}
.caret{fill:${t.caret};animation:move ${typingMs}ms step-end ${startMs}ms forwards}
@keyframes typed{to{fill:${t.fg}}}
@keyframes move{${frames}to{transform:${end}}}
@media (prefers-reduced-motion:reduce){.line tspan{animation:none;fill:${t.fg}}.caret{animation:none;transform:${end}}}
</style>
<text class="name" x="0" y="44">${NAME}</text>
${text}
<rect class="caret" x="${X - 1}" y="${ROW_Y[0] - 14}" width="2" height="19" rx="1"/>
<text class="note" x="${X}" y="${H - 8}">typed at ${wpm} wpm, my Monkeytype ${TEST}s best</text>
</svg>
`;
}

for (const [mode, t] of Object.entries(themes)) {
  writeFileSync(new URL(`../assets/hero-${mode}.svg`, import.meta.url), svg(t));
}
console.log(`rendered at ${wpm} wpm, ${typingMs} ms of typing`);
