// =============================================================
// Index controls: live search + segmented sort + segmented verse toggle
// =============================================================

const tbody = document.querySelector("#hymn-index tbody");
const allRows = Array.from(tbody.querySelectorAll(".hymn-row"));
const searchInput = document.getElementById("search");

let sortState = "number";
let versesState = "first";
let searchQuery = "";

const collator = new Intl.Collator("sv", { sensitivity: "base" });

// Strip everything that is not a letter (Latin + Swedish å/ä/ö) so that
// "Zara" doesn't sort before "Aaba" because of a leading apostrophe,
// and "—" or "(" don't disturb collation.
function sortKey(str) {
  return String(str || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
}

// --- Sorting ---------------------------------------------------
function applySort() {
  if (sortState === "number") {
    sortByNumber();
  } else if (versesState === "all") {
    sortAlphaIndividual();
  } else {
    sortAlphaByHymn();
  }
}

function sortByNumber() {
  // Group by hymn, preserve verse order within
  const groups = new Map();
  for (const row of allRows) {
    const num = row.dataset.number;
    if (!groups.has(num)) groups.set(num, []);
    groups.get(num).push(row);
  }
  const groupArr = Array.from(groups.values()).sort((a, b) =>
    parseInt(a[0].dataset.number, 10) - parseInt(b[0].dataset.number, 10)
  );
  reflow(groupArr.flat());
}

function sortAlphaByHymn() {
  // Sort hymns by their first verse's first line (the title-sort)
  const groups = new Map();
  for (const row of allRows) {
    const num = row.dataset.number;
    if (!groups.has(num)) groups.set(num, []);
    groups.get(num).push(row);
  }
  const groupArr = Array.from(groups.values()).sort((a, b) =>
    collator.compare(sortKey(a[0].dataset.titleSort), sortKey(b[0].dataset.titleSort))
  );
  reflow(groupArr.flat());
}

function sortAlphaIndividual() {
  // Each verse row sorts independently by its own first line
  const sorted = allRows.slice().sort((a, b) =>
    collator.compare(sortKey(a.dataset.firstlineSort), sortKey(b.dataset.firstlineSort))
  );
  reflow(sorted);
}

function reflow(rows) {
  const frag = document.createDocumentFragment();
  for (const row of rows) frag.appendChild(row);
  tbody.appendChild(frag);
}

// --- Filtering -------------------------------------------------
// Same normalization as the build-time normalizer in eleventy.config.js
function normalizeSearch(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyFilter() {
  const raw = searchQuery.trim();
  const isNumber = /^\d+$/.test(raw);

  // Detect language prefix: /en: /fr: /sv: /fn: (case-insensitive).
  // Default: search Swedish only.
  let lang = "sv";
  let q = raw;
  const prefixMatch = raw.match(/^\/(en|fr|sv|fn):\s*(.*)$/i);
  if (prefixMatch) {
    lang = prefixMatch[1].toLowerCase();
    q = prefixMatch[2];
  }
  q = normalizeSearch(q);

  const dataAttr = "search" + lang.charAt(0).toUpperCase() + lang.slice(1);

  // For footnote search, also collapse to one row per hymn (first verse only)
  const isFootnoteSearch = lang === "fn";

  // When searching by text, reveal all matching verses (except for fn,
  // which is per-hymn — keep only first verse rows visible).
  const showOtherVerses =
    versesState === "all" || (q.length > 0 && !isNumber && !isFootnoteSearch);
  document.body.classList.toggle("show-all-verses-search", showOtherVerses);
  document.body.classList.toggle("is-searching", q.length > 0 && !isNumber);

  // Set language class on body so CSS shows the correct verse-extra
  document.body.classList.toggle("search-lang-sv", lang === "sv");
  document.body.classList.toggle("search-lang-en", lang === "en");
  document.body.classList.toggle("search-lang-fr", lang === "fr");
  document.body.classList.toggle("search-lang-fn", lang === "fn");

  for (const row of allRows) {
    let matches;
    if (q === "") {
      matches = true;
    } else if (isNumber) {
      matches = row.dataset.number === q && row.classList.contains("is-first-verse");
    } else if (isFootnoteSearch) {
      // Match against per-hymn footnote, only show first-verse row
      const text = row.dataset.searchFn || "";
      matches = text.includes(q) && row.classList.contains("is-first-verse");
    } else {
      const text = row.dataset[dataAttr] || "";
      matches = text.includes(q);
    }
    row.classList.toggle("is-hidden", !matches);
  }
}

// --- Segmented controls ---------------------------------------
function setupSegmented(controlName, onChange) {
  const root = document.querySelector(`.segmented[data-control="${controlName}"]`);
  if (!root) return;
  const buttons = root.querySelectorAll(".seg-btn");
  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("is-active")) return;
      for (const b of buttons) b.classList.remove("is-active");
      btn.classList.add("is-active");
      onChange(btn.dataset.value);
    });
  }
}

setupSegmented("sort", (value) => {
  sortState = value;
  applySort();
});

setupSegmented("verses", (value) => {
  versesState = value;
  applySort();   // verses change can affect sort grouping when alpha
  applyFilter();
});

// --- Search ----------------------------------------------------
searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  applyFilter();
});

// --- Back to top -----------------------------------------------
const backToTop = document.getElementById("back-to-top");
if (backToTop) {
  backToTop.hidden = false;
  const showThreshold = 400;
  const onScroll = () => {
    const scrolled = window.scrollY > showThreshold;
    backToTop.classList.toggle("is-visible", scrolled);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  onScroll();
}

// --- Epigraph: pick a random verse from the pool on each page load -----
const epigraphEl = document.getElementById("epigraph");
if (epigraphEl) {
  try {
    const pool = JSON.parse(epigraphEl.dataset.pool || "[]");
    if (pool.length > 1) {
      const choice = pool[Math.floor(Math.random() * pool.length)];
      epigraphEl.querySelector(".epigraph-text").textContent = choice.text;
      epigraphEl.querySelector(".epigraph-ref").textContent = choice.ref;
    }
  } catch (err) {
    // pool malformed — keep the server-rendered fallback
  }
}

// Initial render
applySort();
applyFilter();
