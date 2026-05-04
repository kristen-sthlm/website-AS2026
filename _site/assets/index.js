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
function applyFilter() {
  const q = searchQuery.trim().toLowerCase();
  const isNumber = /^\d+$/.test(q);

  // When searching by text, reveal all matching verses (not when searching
  // by number — there we want one row per hymn, the first verse)
  const showOtherVerses =
    versesState === "all" || (q.length > 0 && !isNumber);
  document.body.classList.toggle("show-all-verses-search", showOtherVerses);

  for (const row of allRows) {
    let matches;
    if (q === "") {
      matches = true;
    } else if (isNumber) {
      // Exact match on the hymn number, only first-verse row
      matches = row.dataset.number === q && row.classList.contains("is-first-verse");
    } else {
      const text = row.dataset.searchText || "";
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

// Initial render
applySort();
applyFilter();
