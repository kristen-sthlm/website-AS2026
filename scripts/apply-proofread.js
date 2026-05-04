#!/usr/bin/env node
/**
 * apply-proofread.js
 *
 * Reverse of build-proofread.js.  Reads the aggregated documents in
 * proofread/{sv,en,fr}.md and rewrites the individual hymn files in
 * src/hymns/.
 *
 *   node scripts/apply-proofread.js          # dry run (default)
 *   node scripts/apply-proofread.js --write  # actually write changes
 *
 * Safety:
 *   - Dry run by default; nothing is written without --write
 *   - On --write, src/hymns/ is backed up to src/hymns.backup-{timestamp}/
 *     before any file is modified
 *   - The script refuses to create new files; if a hymn in the proofread
 *     document has no matching individual file, it is skipped with a warning
 *   - Front-matter fields other than `footnote` are preserved untouched
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const HYMNS_DIR = path.join(ROOT, "src", "hymns");
const PROOFREAD_DIR = path.join(ROOT, "proofread");

const WRITE = process.argv.includes("--write");

const LANGS = ["sv", "en", "fr"];

// --- Helpers --------------------------------------------------

function pad3(n) {
  return String(n).padStart(3, "0");
}

// Parse YAML-like front-matter; returns { fmRaw, data, body }
function parseFrontMatter(text) {
  if (!text.startsWith("---")) return { fmRaw: "", data: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { fmRaw: "", data: {}, body: text };
  const fmRaw = text.slice(0, end + 4);
  const fmText = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\n/, "");
  const data = {};
  for (const line of fmText.split("\n")) {
    const m = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (/^-?\d+$/.test(val)) val = parseInt(val, 10);
    data[m[1]] = val;
  }
  return { fmRaw, data, body };
}

// Re-serialize front-matter, preserving original field order from the
// source file and replacing only the values we care about. Unknown fields
// are kept verbatim. New fields are appended at the end.
function rewriteFrontMatter(originalFm, updates) {
  if (!originalFm) {
    // No previous front-matter — just write the updates
    const lines = ["---"];
    for (const [k, v] of Object.entries(updates)) {
      lines.push(`${k}: ${formatYamlValue(v)}`);
    }
    lines.push("---");
    return lines.join("\n");
  }

  // Original starts with --- and ends with \n---
  const inner = originalFm.replace(/^---\n/, "").replace(/\n---\n?$/, "");
  const lines = inner.split("\n");
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const m = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (m && Object.prototype.hasOwnProperty.call(updates, m[1])) {
      out.push(`${m[1]}: ${formatYamlValue(updates[m[1]])}`);
      seen.add(m[1]);
    } else {
      out.push(line);
    }
  }
  // Append any update keys that weren't in the original
  for (const [k, v] of Object.entries(updates)) {
    if (!seen.has(k)) {
      out.push(`${k}: ${formatYamlValue(v)}`);
    }
  }
  return ["---", ...out, "---"].join("\n");
}

function formatYamlValue(v) {
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return JSON.stringify(v);
  // Quote if it contains characters that would confuse our parser
  if (/[:#'"]/.test(v) || v.trim() !== v) {
    // Use double quotes, escape internal double quotes
    return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return v;
}

// Split an aggregated proofread document into per-hymn entries.
// Returns array of { number, footnote, body }.
function splitProofread(md) {
  const hymns = [];
  // Split on lines beginning with "## Sång N"
  const headingRe = /^##\s+Sång\s+(\d+)\s*$/m;
  // Walk the document keeping the position of each heading
  const positions = [];
  let m;
  const re = /^##\s+Sång\s+(\d+)\s*$/gm;
  while ((m = re.exec(md)) !== null) {
    positions.push({ number: parseInt(m[1], 10), start: m.index, headingEnd: m.index + m[0].length });
  }

  for (let i = 0; i < positions.length; i++) {
    const cur = positions[i];
    const next = positions[i + 1];
    const segment = md.slice(cur.headingEnd, next ? next.start : md.length);
    // The segment starts with "\n\n", optionally "> footnote\n\n", then body, ending with "\n---\n"
    let footnote = null;
    let bodyText = segment;

    // Trim leading whitespace
    bodyText = bodyText.replace(/^\s+/, "");

    // Try to extract a leading blockquote-as-footnote
    const fnMatch = bodyText.match(/^>\s+(.+?)\n\n/s);
    if (fnMatch) {
      footnote = fnMatch[1].replace(/\n>\s+/g, " ").trim();
      bodyText = bodyText.slice(fnMatch[0].length);
    }

    // Strip trailing horizontal rule and surrounding whitespace
    bodyText = bodyText.replace(/\n+---\s*$/, "").trim() + "\n";

    hymns.push({ number: cur.number, footnote, body: bodyText });
  }

  return hymns;
}

// --- Main per-language application ----------------------------

function processLang(lang) {
  const proofreadFile = path.join(PROOFREAD_DIR, `${lang}.md`);
  if (!fs.existsSync(proofreadFile)) {
    console.log(`  [${lang}] no proofread file found, skipping`);
    return [];
  }

  const md = fs.readFileSync(proofreadFile, "utf8");
  const hymns = splitProofread(md);
  console.log(`  [${lang}] parsed ${hymns.length} hymn entries`);

  const changes = [];

  for (const h of hymns) {
    const targetPath = path.join(HYMNS_DIR, `${pad3(h.number)}-${lang}.md`);
    if (!fs.existsSync(targetPath)) {
      console.warn(`  [${lang}] WARN: ${path.basename(targetPath)} does not exist; refusing to create. Skipped hymn ${h.number}.`);
      continue;
    }

    const orig = fs.readFileSync(targetPath, "utf8");
    const { fmRaw, data, body: origBody } = parseFrontMatter(orig);

    // Build updates
    const updates = {};
    if (lang === "sv" && h.footnote !== null) {
      // Preserve footnote on Swedish files only
      if (data.footnote !== h.footnote) {
        updates.footnote = h.footnote;
      }
    }

    // Compute new file content
    const newFm = Object.keys(updates).length > 0 ? rewriteFrontMatter(fmRaw, updates) : fmRaw;
    const newBody = h.body;
    const newContent = newFm + "\n\n" + newBody;

    // Compare to detect actual change. Ignore pure trailing/internal
    // whitespace-only differences so the first round-trip after generation
    // does not flag every file as changed.
    const normalize = (s) => s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trimEnd();
    if (normalize(newContent) === normalize(orig)) continue;

    changes.push({ targetPath, before: orig, after: newContent, hymn: h.number });
  }

  return changes;
}

// --- Entry point ---------------------------------------------

console.log(WRITE ? "Applying proofread changes…" : "DRY RUN (use --write to apply)…");

let allChanges = [];
for (const lang of LANGS) {
  const changes = processLang(lang);
  allChanges = allChanges.concat(changes);
}

console.log("");
console.log(`Total files with changes: ${allChanges.length}`);

if (allChanges.length === 0) {
  console.log("Nothing to apply.");
  process.exit(0);
}

// Show a short summary
for (const c of allChanges) {
  console.log(`  ~ ${path.relative(ROOT, c.targetPath)}  (sång ${c.hymn})`);
}

if (!WRITE) {
  console.log("");
  console.log("Re-run with --write to apply these changes.");
  process.exit(0);
}

// --- Backup then write ---------------------------------------

const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace(/T/, "_").slice(0, 19);
const backupDir = path.join(path.dirname(HYMNS_DIR), `hymns.backup-${stamp}`);
console.log("");
console.log(`Creating backup at ${path.relative(ROOT, backupDir)}…`);
fs.cpSync(HYMNS_DIR, backupDir, { recursive: true });

console.log("Writing changes…");
for (const c of allChanges) {
  fs.writeFileSync(c.targetPath, c.after);
}
console.log(`Wrote ${allChanges.length} files.`);
console.log("");
console.log("Tip: run `npm run proofread` to regenerate the aggregated docs and verify the round-trip.");
