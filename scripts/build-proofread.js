#!/usr/bin/env node
/**
 * build-proofread.js
 *
 * Concatenates all hymns into one Markdown document per language for
 * end-to-end proofreading.  Output goes to ./proofread/.
 *
 * Run with:   node scripts/build-proofread.js
 *
 * Source files stay untouched.  Reads from src/hymns/NNN-{sv,en,fr}.md
 * and produces:
 *   proofread/sv.md
 *   proofread/en.md
 *   proofread/fr.md
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const HYMNS_DIR = path.join(ROOT, "src", "hymns");
const OUT_DIR = path.join(ROOT, "proofread");

const LANGS = {
  sv: { label: "Andliga Sånger — Svenska" },
  en: { label: "Andliga Sånger — English translation" },
  fr: { label: "Andliga Sånger — Traduction française" },
};

// --- Front-matter parser (minimal, no deps) ---
function parseFrontMatter(text) {
  if (!text.startsWith("---")) return { data: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: text };
  const fmText = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\n/, "");
  const data = {};
  for (const line of fmText.split("\n")) {
    const m = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Numeric coercion
    if (/^-?\d+$/.test(val)) val = parseInt(val, 10);
    data[m[1]] = val;
  }
  return { data, body };
}

// --- Discover hymns ---
function listHymnFiles(lang) {
  const langDir = path.join(HYMNS_DIR, lang);
  if (!fs.existsSync(langDir)) return [];
  const all = fs.readdirSync(langDir);
  return all
    .map((name) => {
      const m = name.match(/^(\d+)\.md$/);
      return m ? { number: parseInt(m[1], 10), file: path.join(langDir, name) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);
}

// --- Build one language ---
function buildLanguage(lang) {
  const hymns = listHymnFiles(lang);
  if (hymns.length === 0) {
    console.log(`  (no ${lang} files found)`);
    return;
  }

  const parts = [];
  parts.push(`# ${LANGS[lang].label}`);
  parts.push("");
  parts.push(`*Genererat ${new Date().toISOString().slice(0, 10)} från ${hymns.length} sånger.*`);
  parts.push("");
  parts.push("---");
  parts.push("");

  // For sv we need the footnote (which only lives there); for en/fr we
  // also fetch it from the matching sv file so proofreaders see context.
  for (const { number, file } of hymns) {
    const raw = fs.readFileSync(file, "utf8");
    const { data, body } = parseFrontMatter(raw);

    let footnote = data.footnote || "";
    if (!footnote && lang !== "sv") {
      // Try to read the swedish version's footnote
      const svFile = path.join(HYMNS_DIR, "sv", `${String(number).padStart(3, "0")}.md`);
      if (fs.existsSync(svFile)) {
        const svRaw = fs.readFileSync(svFile, "utf8");
        const svFm = parseFrontMatter(svRaw);
        footnote = svFm.data.footnote || "";
      }
    }

    parts.push(`## Sång ${number}`);
    parts.push("");
    if (footnote) {
      parts.push(`> ${footnote}`);
      parts.push("");
    }
    parts.push(body.trim());
    parts.push("");
    parts.push("---");
    parts.push("");
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${lang}.md`);
  fs.writeFileSync(outPath, parts.join("\n"));
  console.log(`  ${lang}: ${hymns.length} sånger → ${path.relative(ROOT, outPath)}`);
}

// --- Main ---
console.log("Building proofreading documents…");
for (const lang of Object.keys(LANGS)) {
  buildLanguage(lang);
}
console.log("Done.");
