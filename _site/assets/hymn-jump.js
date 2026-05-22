// Jump to another hymn number from the topbar input.
// Works on both the lyrics page (data-target="text") and the score page
// (data-target="score"). For text pages, current language is preserved.

const input = document.querySelector(".hymn-number-large");
if (input) {
  const target = input.dataset.target;        // "text" | "score"
  const lang = input.dataset.lang || "sv";    // only used when target=text
  const max = parseInt(input.getAttribute("max"), 10) || 999;
  const initial = input.value;

  // Build path with current site prefix derived from <html data-base>
  const base = document.documentElement.dataset.base || "/";

  function pad3(n) {
    return String(n).padStart(3, "0");
  }

  function urlFor(num) {
    const nnn = pad3(num);
    const tail = target === "score" ? `${nnn}-score/` : `${nnn}-${lang}/`;
    // base already ends with "/"
    return `${base}hymns/${tail}`;
  }

  function go() {
    const raw = input.value.trim();
    if (raw === "" || raw === initial) return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > max) {
      input.value = initial;
      return;
    }
    window.location.href = urlFor(n);
  }

  // Select all on focus for quick replace
  input.addEventListener("focus", () => input.select());

  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      input.blur();           // triggers go() via the blur handler
    } else if (ev.key === "Escape") {
      input.value = initial;
      input.blur();
    }
  });

  input.addEventListener("blur", go);
}
