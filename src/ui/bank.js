// Story Bits page, your keepings: the word bank and its form, the kept shelf, and the word-pack
// and share links that carry them.

// ---------- word bank (yours, kept in this browser) ----------
const BANK_KEY = "story-bits-bank";
function loadBank() {
  try { return (JSON.parse(localStorage.getItem(BANK_KEY)) || []).filter((e) => e && typeof e.t === "string"); } catch { return []; }
}
function saveBank() {
  try { localStorage.setItem(BANK_KEY, JSON.stringify(bank)); } catch {}
}
bank = loadBank();
// Adds checked, new words, as one step on the timeline. Returns how many were added.
function addToBank(entries, label) {
  const before = clone(bank);
  let n = 0;
  for (let e of entries) {
    e = { ...e, g: e.g || "story-bits" };
    const gram = resolveGrammar(e.g);
    if (!gram || checkEntry(e, gram) || builtinHas(e, gram) || bank.some((b) => sameWord(b, e))) continue;
    bank.push(e);
    n++;
  }
  saveBank();
  if (n) remember("bank", label || (n === 1 ? bankLabel(bank[bank.length - 1], true) : `added ${n} words to the word bank`), before, bank);
  return n;
}

// ---------- the kept shelf (phrases you keep coming back to) ----------
// The shelf's model (shelfKey, castToShelf, pinPhrase…) is in engine.js; this is its storage.
const SHELF_KEY = "story-bits-kept";
const CAST_KEY = "story-bits-cast"; // before the shelf: Story Bits characters only, { g, who, bits }
function loadShelf() {
  try {
    const kept = JSON.parse(localStorage.getItem(SHELF_KEY));
    if (Array.isArray(kept)) return kept.filter(shelfOk);
  } catch {}
  // First run with the shelf: bring the old cast across. The old key stays as it was, so nothing
  // is lost even if this browser goes back to an older page.
  try {
    const shelf = castToShelf(JSON.parse(localStorage.getItem(CAST_KEY)) || [], (g) => resolveGrammar(g)?.pronouns);
    if (shelf.length) localStorage.setItem(SHELF_KEY, JSON.stringify(shelf));
    return shelf;
  } catch { return []; }
}
function saveShelf() {
  try { localStorage.setItem(SHELF_KEY, JSON.stringify(shelf)); } catch {}
}
let shelf = [];
const shelfHere = () => shelfFor(shelf, G);
function addToShelf(entry) {
  const c = shelve(shelf, entry);
  saveShelf();
  renderShelf();
  return c;
}

function keepBit() {
  const card = keepOf(G).card;
  if (!state.pick[card]) return;
  const before = clone(shelf);
  const c = addToShelf({ g: G.id, card, ph: clone(state.pick[card]), bits: [bitLine(context())] });
  if (!same(before, shelf)) remember("shelf", `kept ${keptText(card, c.ph)}`, before, shelf);
  toast(`Kept · on your shelf: ${cap(keptText(card, c.ph))}`, { label: "Open shelf", fn: openShelf });
  flashShelf();
}
// Open the shelf fold (named "The cast", "Your material"… per grammar) and bring it into view.
function openShelf() {
  const d = document.querySelector('details[data-fold="cast"]');
  if (!d) return;
  d.open = true;
  d.dispatchEvent(new Event("toggle"));
  d.scrollIntoView({ behavior: "smooth", block: "start" });
}
function flashShelf() {
  const s = document.querySelector('details[data-fold="cast"] > summary');
  if (!s) return;
  s.classList.remove("kept-flash");
  void s.offsetWidth;
  s.classList.add("kept-flash");
}
// Pin a kept phrase and shuffle everything else: a new piece around something kept.
function tellAnother(i) {
  const c = shelf[i];
  if (!c || c.g !== G.id || c.card !== keepOf(G).card) return;
  pinPhrase(c.card, c.ph);
  hintNext(`told another with “${keptText(c.card, c.ph)}”`);
  reroll(SLOTS.map((x) => x.key).filter((k) => k !== c.card));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toHash() {
  if (state.room) return `#jam=${state.room.code}${state.room.key ? `~${state.room.key}` : ""}`;
  // Mid-challenge, the link holds the challenge and your copy, so a reload picks up where you were.
  if (state.game) return "#p=" + b64(JSON.stringify(playPayload()));
  // Comparing (and not playing): keep the set of versions in the link.
  if (state.compare && !state.compare.drafts) return "#cmp=" + b64(JSON.stringify({ c: state.compare.c, e: state.compare.entries.map((e) => ({ name: e.name, me: e.me })) }));
  return "#" + b64(JSON.stringify(snapshot()));
}

// A pack link carries words only: "#pack=<base64url JSON { name, words }>".
function packLink() {
  const pack = { name: "Shared words", words: bank };
  return `${location.origin}${location.pathname}#pack=${b64(JSON.stringify(pack))}`;
}
function importPack(h) {
  try {
    const pack = JSON.parse(unb64(h));
    const words = Array.isArray(pack.words) ? pack.words : [];
    const n = addToBank(words, `added words from “${cleanWord(pack.name) || "a pack"}”`);
    toast(n ? `Added ${n} word${n === 1 ? "" : "s"} from “${cleanWord(pack.name) || "a pack"}” to your word bank.` : "Those words are already in your bank.");
  } catch { toast("That pack link couldn't be read."); }
}

// Words that reach everyone: a pre-filled GitHub issue. A maintainer labels it accepted-pack,
// and .github/workflows/word-pack.yml turns it into a pull request adding packs/issue-N.json.
const REPO = "https://github.com/reeswrites/story-bits";
function suggestLink() {
  const pack = { name: "Suggested words", words: bank };
  const body = `Words suggested from Story Bits for the shared word bank.\n\nA maintainer adds the \`accepted-pack\` label to turn this into a pull request. Edit the list below first if any words shouldn't go in.\n\n\`\`\`json\n${JSON.stringify(pack, null, 1)}\n\`\`\`\n`;
  return `${REPO}/issues/new?${new URLSearchParams({ title: `Word pack: ${bank.length} word${bank.length === 1 ? "" : "s"}`, labels: "word-pack", body })}`;
}

// Shared packs that made it into the repo: packs/index.json lists files, loaded in order and
// appended to the pools. Append-only, so the indices in older links stay put.
async function loadPacks() {
  try {
    const files = await (await fetch("packs/index.json")).json();
    for (const f of files) {
      if (!/^[\w-]+\.json$/.test(f)) continue;
      const pack = await (await fetch(`packs/${f}`)).json();
      // Whole grammars first, so the words and forms below can belong to them. An id already
      // taken is skipped, so links to a grammar never change meaning.
      for (const [id, gram] of Object.entries(pack.grammars || {})) if (!GRAMMARS[id] && gram?.id === id && !checkGrammar(gram)) GRAMMARS[id] = { ...gram, shared: true };
      for (const e of pack.words || []) {
        const gram = GRAMMARS[e.g || "story-bits"];
        if (gram && !checkEntry(e, gram) && !builtinHas(e, gram)) gram.schemas[e.s].parts.find((p) => p.k === e.k).pool.push(poolEntry(e, gram));
      }
      // Forms join a grammar by key (pack.grammar, default Story Bits); a taken key is skipped.
      const fg = GRAMMARS[pack.grammar || "story-bits"];
      if (fg) for (const [k, f] of Object.entries(pack.forms || {})) if (!fg.forms[k] && /^[a-z][a-z0-9-]{0,23}$/.test(k) && !checkForm(f, fg)) fg.forms[k] = { ...f, pack: true };
    }
  } catch {}
}


function renderShelf() {
  const el = $("#cast");
  const k = keepOf(G);
  $("#cast-h").textContent = k.name;
  const n = shelfHere().length;
  let badge = $("#cast-count");
  if (!badge) { badge = document.createElement("span"); badge.id = "cast-count"; badge.className = "count"; $("#cast-h").after(badge); }
  badge.textContent = n ? `${n} kept` : "";
  $("#keep").firstChild.textContent = k.verb + " ";
  $("#keep .menu-note").textContent = `adds ${k.card === G.pronouns ? "them" : "it"} to ${shelfName(G)}`;
  const help = $(".cast-wrap .help");
  if (help) help.textContent = k.note || `What you've kept in ${G.name}, and every ${(G.headline || "The line").replace(/^the\s+/i, "").toLowerCase()} it has been in.`;
  const here = shelfHere();
  if (!here.length) {
    el.innerHTML = `<p class="empty">Nothing yet. Choose <i>${esc(k.verb)}</i><span class="kbd-hint"> (<kbd>k</kbd>)</span> and it lands here. Then tell another with it, and it starts to feel like something you know.</p>`;
    return;
  }
  el.innerHTML = here.map(({ c, i }) => {
    const pr = keptWho(c.card, c.ph);
    return `
    <article class="person">
      <header><h3>${esc(cap(keptText(c.card, c.ph)))}</h3>
        <span class="count">${headlineCount(c.bits.length)}</span></header>
      <ul>${c.bits.slice(0, 6).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      <div class="person-actions">
        <button class="ghost" data-another="${i}">Tell another${c.card === G.pronouns ? ` about ${esc(pr.o)}` : ""}</button>
        <button class="ghost subtle" data-forget="${i}">Forget</button>
      </div>
    </article>`;
  }).join("");
}

// ---------- word bank form ----------
function renderBankForm() {
  const sel = $("#bf-slot");
  const keep = sel.value;
  sel.innerHTML = SLOTS.map((s) => `<optgroup label="${esc(s.label)}">${SCHEMAS[s.key].parts.map((p) =>
    `<option value="${s.key}.${p.k}">${esc(s.label)}: ${esc((p.frame || p.name).replace("{det}", "a"))}</option>`).join("")}</optgroup>`).join("");
  // Default to a describing slot if the grammar has one, else the first slot.
  const fallback = SLOTS.flatMap((s) => SCHEMAS[s.key].parts.filter((p) => p.k === "q").map((p) => `${s.key}.${p.k}`))[0];
  sel.value = [...sel.options].some((o) => o.value === keep) ? keep : fallback || sel.options[0].value;
  $("#bank-h").textContent = `Word bank · ${G.name}`;
  updateBankForm();
}
function formEntry() {
  const [s, k] = $("#bf-slot").value.split(".");
  const e = { g: G.id, s, k, t: cleanWord($("#bf-text").value), tier: +document.querySelector('[name="bf-tier"]:checked').value };
  if (needsMood(s, k, G)) e.v = +document.querySelector('[name="bf-mood"]:checked').value;
  if (detsFor(s, k, G)) e.det = $("#bf-det").value;
  if (needsPronouns(s, k, G)) e.pr = $("#bf-pr").value;
  return e;
}
function updateBankForm() {
  const [s, k] = $("#bf-slot").value.split(".");
  const part = partOf(s, k);
  const dets = detsFor(s, k, G);
  $("#bf-mood-row").hidden = !part.mood;
  $("#bf-det-row").hidden = !dets;
  $("#bf-pr-row").hidden = !part.pronouns;
  if (dets) {
    const d = $("#bf-det");
    const keep = d.value;
    d.innerHTML = dets.map((x) => `<option>${esc(x)}</option>`).join("");
    if (dets.includes(keep)) d.value = keep;
  }
  const e = formEntry();
  let det = e.det || "";
  const shown = e.t ? `<b>${esc(e.t)}</b>` : `<b class="blank">___</b>`;
  if (det === "a" && e.t) det = /^[aeiou]/i.test(e.t) ? "an" : "a";
  $("#bf-frame").innerHTML = esc(part.frame || "___").replace("{det}", esc(det)).replace("___", shown);
  const rules = (G.rules.constraints || []).map(describeConstraint).filter(Boolean);
  $("#bf-hint").textContent = [part.hint || `A word for “${part.name}”.`, rules.length ? `This grammar: ${rules.join("; ")}.` : ""].filter(Boolean).join(" ");
  const err = grammarClosed(G) ? "This grammar is closed: it only uses its own words. Fork it to add some." : e.t ? checkEntry(e, G) || (builtinHas(e) || bank.some((b) => sameWord(b, e)) ? "Already in the bank." : "") : "";
  $("#bf-error").textContent = err;
  // Never disabled: pressing it with nothing typed (or a word that won't fit) says why (bankSubmit).
  $("#bf-add").disabled = false;
}
// The form's Add: true if a word went in. Otherwise the reason shows under the preview.
function bankSubmit() {
  const entry = formEntry();
  const input = $("#bf-text");
  if (!entry.t) {
    $("#bf-error").textContent = "Type a word or phrase to add first.";
    input.focus();
    return false;
  }
  if ($("#bf-error").textContent) { input.focus(); return false; }
  if (!addToBank([entry])) { $("#bf-error").textContent = "That word can't be added here."; return false; }
  toast(`Added “${entry.t}” to your word bank. It'll turn up in shuffles.`);
  input.value = "";
  return true;
}
function renderBank() {
  const el = $("#bank-list");
  const mineAll = bank.map((e, i) => ({ e, i })).filter((x) => gOf(x.e) === G.id && partIn(G, x.e.s, x.e.k));
  if (!mineAll.length) {
    el.innerHTML = `<p class="empty">No words of your own for ${esc(G.name)} yet. Add one above, or type your own in any word's picker.</p>`;
  } else {
    el.innerHTML = SLOTS.map((s) => {
      const mine = mineAll.filter((x) => x.e.s === s.key);
      if (!mine.length) return "";
      return `<div class="bank-group"><h4>${esc(s.label)}</h4>${mine.map((x) =>
        `<span class="bank-word" title="${esc(partOf(x.e.s, x.e.k).name)} · ${TIER_NAMES[x.e.tier]}">${esc(x.e.t)}<span class="bw-slot">${esc(partOf(x.e.s, x.e.k).name)}</span><button class="bw-x" data-unbank="${x.i}" aria-label="Remove ${esc(x.e.t)} from your bank">✕</button></span>`).join("")}</div>`;
    }).join("");
  }
  $("#bank-share").disabled = $("#bank-suggest").disabled = !mineAll.length;
  $("#bank-count").textContent = mineAll.length ? `${mineAll.length} word${mineAll.length === 1 ? "" : "s"}` : "";
}
