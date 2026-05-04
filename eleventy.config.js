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

      // Parse this language's verses and store under versesByLang[lang]
      const raw = fs.readFileSync(item.inputPath, "utf8");
      const body = stripFrontMatter(raw);
      const parsed = parseVerses(body);
      grouped[num].versesByLang[lang] = parsed;

      if (lang === "sv") {
        grouped[num].verses = parsed;
      }
    }

    // Build per-verse search text — concatenating the same verse number
    // across all available languages. Then a search for "saints" matches
    // only the verse where "saints" actually appears, in any language.
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

    return Object.values(grouped).sort((a, b) => a.number - b.number);
  });

  // Pad hymn numbers to 3 digits: 1 -> "001", 47 -> "047"
  eleventyConfig.addFilter("pad3", (value) => String(value).padStart(3, "0"));

  // Render a short string of inline markdown (e.g. *italic*, **bold**)
  // without wrapping it in <p> tags. Used for the footnote field.
  eleventyConfig.addFilter("inlineMarkdown", (value) => {
    if (!value) return "";
    return String(value)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>");
  });

  // Inline an SVG score with its viewBox tightened to actual content bounds.
  // LilyPond ships SVGs with ~8-12% empty margin; this reclaims that space
  // for phone screens.
  eleventyConfig.addShortcode("inlineScore", function (padded, page) {
    const filePath = path.join("src/hymns/scores", `${padded}-${page}.svg`);
    if (!fs.existsSync(filePath)) return "";
    let svg = fs.readFileSync(filePath, "utf8");
    return tightenSvg(svg);
  });

  return {
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

// Tighten a LilyPond SVG: read translate() values to find the actual
// drawn bounds, then rewrite the viewBox to those bounds with a small
// safety pad. Also strips the explicit width/height in mm so the SVG
// scales fluidly to its container.
function tightenSvg(svg) {
  const viewBoxMatch = svg.match(/viewBox="([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)"/);
  if (!viewBoxMatch) return svg;

  const [vbX, vbY, vbW, vbH] = viewBoxMatch.slice(1).map(parseFloat);

  // Find content bounds via translate() coordinates
  const translates = [...svg.matchAll(/translate\(\s*([\d.\-]+)\s*,\s*([\d.\-]+)\s*\)/g)];
  if (translates.length === 0) return svg;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const m of translates) {
    const x = parseFloat(m[1]);
    const y = parseFloat(m[2]);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // Add a small safety pad so notes near the edge are not clipped
  const padX = 2;
  const padY = 2;
  const newX = Math.max(vbX, minX - padX);
  const newY = Math.max(vbY, minY - padY);
  const newW = Math.min(vbW - (newX - vbX), (maxX - minX) + 2 * padX);
  const newH = Math.min(vbH - (newY - vbY), (maxY - minY) + 2 * padY);

  // Replace viewBox
  let out = svg.replace(
    /viewBox="[^"]*"/,
    `viewBox="${newX.toFixed(2)} ${newY.toFixed(2)} ${newW.toFixed(2)} ${newH.toFixed(2)}"`
  );

  // Strip width/height so the SVG scales fluidly via CSS
  out = out.replace(/\swidth="[^"]*mm"/, "");
  out = out.replace(/\sheight="[^"]*mm"/, "");

  return out;
}
