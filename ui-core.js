// Story Bits page, shared basics: $, toast, copy, the stored-value helpers, the grammar library's
// storage, and the phone-or-popover test. Loaded first of the page files; others lean on it.
const $ = (s) => document.querySelector(s);

// Your library: grammars you've forked, written or imported, kept in this browser.
const LIB_KEY = "story-bits-grammars";
function loadLibrary() {
  try {
    const out = {};
    for (const g of JSON.parse(localStorage.getItem(LIB_KEY)) || []) if (!checkGrammar(g) && !GRAMMARS[g.id]) out[g.id] = g;
    return out;
  } catch { return {}; }
}
// Saving also saves a version of each grammar that changed (history.js), labelled for the
// timeline; it returns those timeline entries.
function saveLibrary(label) {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(Object.values(library))); } catch {}
  return syncVersions(label);
}
library = loadLibrary();

// On a phone the picker is a bottom sheet (at most ~55% of the screen) and the line holding the
// selected word stays in view above it. On a wider screen it's a popover under the word.
const isSheet = () => innerWidth < 640;
function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} }
function stored(k) { try { return localStorage.getItem(k); } catch { return null; } }
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

const pathOf = (el) => (el.dataset.path ? el.dataset.path.split(".") : []);
function copy(text, ok) {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
    .then(() => toast(ok))
    .catch(() => window.prompt("Copy this link:", text));
}
