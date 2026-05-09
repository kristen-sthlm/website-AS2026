import fs from "node:fs";
import path from "node:path";

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/hymns/audio");
  eleventyConfig.addPassthroughCopy("src/hymns/scores");

  eleventyConfig.addCollection("hymns", (collectionApi) => {
    const all = collectionApi
      .getAll()
      .filter((item) => item.inputPath.includes("/hymns/") && item.inputPath.endsWith(".md"));

    const grouped = {};
    for (const item of all) {
      // Match either old layout (NNN-lang.md) or new layout (lang/NNN.md)
      const inputPath = item.inputPath.replace(/\\/g, "/");
      let num = null;
      let lang = null;

      // New layout: src/hymns/{lang}/{NNN}.md
      const folderMatch = inputPath.match(/\/hymns\/([a-z]+)\/(\d+)\.md$/);
      if (folderMatch) {
        lang = folderMatch[1];
        num = parseInt(folderMatch[2], 10);
      } else {
        // Legacy fallback: src/hymns/{NNN}-{lang}.md
        const flatMatch = path.basename(inputPath).match(/^(\d+)-([a-z]+)\.md$/);
        if (flatMatch) {
          num = parseInt(flatMatch[1], 10);
          lang = flatMatch[2];
        }
      }
      if (num === null || lang === null) continue;
      // Override hymnnumber from filename so files don't need to repeat it
      if (!item.data.hymnnumber) item.data.hymnnumber = num;

      if (!grouped[num]) grouped[num] = { number: num, languages: {}, versesByLang: {} };
      grouped[num].languages[lang] = item;

      const raw = fs.readFileSync(item.inputPath, "utf8");
      const body = stripFrontMatter(raw);
      const parsed = parseVerses(body);
      grouped[num].versesByLang[lang] = parsed;

      if (lang === "sv") {
        grouped[num].verses = parsed;
        grouped[num].footnote = (item.data.footnote || "").toLowerCase();
      }
    }

    // Count actual score PNG files on disk for each hymn
    for (const hymn of Object.values(grouped)) {
      const padded = String(hymn.number).padStart(3, "0");
      let count = 0;
      while (fs.existsSync(path.join("src/hymns/scores", `${padded}-${count + 1}.png`))) {
        count++;
      }
      hymn.scorePages = count;
    }

    // Build per-language search text and lines for each verse.
    // Normalization: lowercase, strip punctuation, collapse whitespace.
    // The same rule must be applied to the query in the JS.
    const normalize = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

    for (const hymn of Object.values(grouped)) {
      if (!hymn.verses) continue;
      hymn.footnote = normalize(hymn.footnote);
      for (const v of hymn.verses) {
        v.searchSv = normalize(v.lines.join(" "));
        v.linesSv = v.lines;
        for (const otherLang of ["en", "fr"]) {
          const other = hymn.versesByLang[otherLang];
          const matchVerse = other ? other.find((x) => x.number === v.number) : null;
          const lines = matchVerse ? matchVerse.lines : [];
          v["search" + otherLang.charAt(0).toUpperCase() + otherLang.slice(1)] =
            normalize(lines.join(" "));
          v["lines" + otherLang.charAt(0).toUpperCase() + otherLang.slice(1)] = lines;
        }
      }
      // Index ordering: same as source (chorus inherits its position from markdown)
      hymn.versesForIndex = hymn.verses;
    }

    // Count actual score pages on disk for each hymn
    for (const hymn of Object.values(grouped)) {
      const padded = String(hymn.number).padStart(3, "0");
      let count = 0;
      for (let n = 1; n <= 9; n++) {
        const f = path.join("src/hymns/scores", `${padded}-${n}.png`);
        if (fs.existsSync(f)) count++;
        else break;
      }
      hymn.scorePages = count;
    }

    return Object.values(grouped).sort((a, b) => a.number - b.number);
  });

  // Pad hymn numbers to 3 digits: 1 -> "001", 47 -> "047"
  eleventyConfig.addFilter("pad3", (value) => String(value).padStart(3, "0"));

  // Count how many score pages exist on disk for a given padded hymn number
  // (e.g., looks for src/hymns/scores/047-1.png, 047-2.png, ...)
  eleventyConfig.addFilter("scorePageCount", (padded) => {
    const dir = "src/hymns/scores";
    if (!fs.existsSync(dir)) return 0;
    let n = 0;
    while (fs.existsSync(path.join(dir, `${padded}-${n + 1}.png`))) {
      n++;
    }
    return n;
  });

  // Inline markdown for the footnote field
  eleventyConfig.addFilter("inlineMarkdown", (value) => {
    if (!value) return "";
    return String(value)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>");
  });

  return {
    pathPrefix: "/website-AS2026/",
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}

function stripFrontMatter(text) {
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end !== -1) return text.slice(end + 4);
  }
  return text;
}

function parseVerses(body) {
  const verses = [];
  const lines = body.split("\n");
  let current = null;
  for (const line of lines) {
    // Accept "# 1.", "# 2.", "# C.", "# R.", "# ل.", etc.
    // The label is captured verbatim; numeric → verse, anything else → chorus.
    const headingMatch = line.match(/^#\s+([\p{L}\p{N}]+)\.?\s*$/u);
    if (headingMatch) {
      if (current) verses.push(current);
      const label = headingMatch[1];
      const isNumeric = /^\d+$/.test(label);
      // Only uppercase Latin letters; leave non-Latin scripts (Arabic etc.) intact
      const normalizedLabel = isNumeric
        ? String(parseInt(label, 10))
        : (/^[A-Za-z]+$/.test(label) ? label.toUpperCase() : label);
      current = {
        number: isNumeric ? parseInt(label, 10) : normalizedLabel,
        kind: isNumeric ? "verse" : "chorus",
        label: normalizedLabel,
        lines: [],
      };
    } else if (current && line.trim()) {
      current.lines.push(line.trim());
    }
  }
  if (current) verses.push(current);
  for (const v of verses) v.firstLine = v.lines[0] || "";
  return verses;
}
