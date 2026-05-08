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
      const num = item.data.hymnnumber;
      if (!num) continue;
      if (!grouped[num]) grouped[num] = { number: num, languages: {}, versesByLang: {} };

      const match = path.basename(item.inputPath).match(/^(\d+)-(\w+)\.md$/);
      if (!match) continue;
      const lang = match[2];
      grouped[num].languages[lang] = item;

      const raw = fs.readFileSync(item.inputPath, "utf8");
      const body = stripFrontMatter(raw);
      const parsed = parseVerses(body);
      grouped[num].versesByLang[lang] = parsed;

      if (lang === "sv") {
        grouped[num].verses = parsed;
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

    // Build per-verse multilingual search text
    for (const hymn of Object.values(grouped)) {
      if (!hymn.verses) continue;
      for (const v of hymn.verses) {
        let combined = v.lines.join(" ");
        for (const otherLang of ["en", "fr"]) {
          const other = hymn.versesByLang[otherLang];
          if (!other) continue;
          const matchVerse = other.find((x) => x.number === v.number);
          if (matchVerse) combined += " " + matchVerse.lines.join(" ");
        }
        v.searchText = combined.toLowerCase();
      }
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
    const headingMatch = line.match(/^#\s+(\d+)\.?\s*$/);
    if (headingMatch) {
      if (current) verses.push(current);
      current = { number: parseInt(headingMatch[1], 10), lines: [] };
    } else if (current && line.trim()) {
      current.lines.push(line.trim());
    }
  }
  if (current) verses.push(current);
  for (const v of verses) v.firstLine = v.lines[0] || "";
  return verses;
}
