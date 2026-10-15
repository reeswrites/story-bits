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
// A toast may carry one action ({ label, fn }). It sits at the bottom, or at the top when a
// field you're typing in is down there, so it never covers the field you're editing.
function toast(msg, action) {
  const t = $("#toast");
  t.textContent = msg;
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = action.label;
    b.onclick = () => { t.classList.remove("show"); action.fn(); };
    t.append(" ", b);
  }
  t.classList.toggle("has-action", !!action);
  // Top if a field you're in, or any visible field, is where the bottom toast would sit.
  const zone = [innerHeight - 150, innerHeight - 24];
  const under = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select")].some((f) => {
    const r = f.getBoundingClientRect();
    return r.width && r.bottom > zone[0] && r.top < zone[1] && r.top >= 0 && !f.closest("[hidden], #toast");
  });
  t.classList.toggle("top", under);
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), action ? 6000 : 2600);
}

const pathOf = (el) => (el.dataset.path ? el.dataset.path.split(".") : []);
// Copy a link: the share sheet on a phone, else the clipboard (with a toast), else a field you
// can select (shown under the toast) instead of a modal prompt.
function copy(text, ok) {
  const field = () => {
    let box = $("#copy-fallback");
    if (!box) {
      box = document.createElement("div");
      box.id = "copy-fallback";
      box.className = "copy-fallback";
      box.innerHTML = `<label>Copy this link<input readonly></label><button type="button" class="ghost">Done</button>`;
      box.querySelector("button").onclick = () => box.remove();
      document.body.append(box);
    }
    const input = box.querySelector("input");
    input.value = text;
    input.focus();
    input.select();
    toast("Couldn't copy automatically. The link is selected: copy it from the field.");
  };
  if (isSheet() && navigator.share && matchMedia("(pointer: coarse)").matches) {
    navigator.share({ url: text }).then(() => toast(ok), (e) => { if (e?.name !== "AbortError") clip(); });
  } else clip();
  function clip() {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(ok)).catch(field);
  }
}
