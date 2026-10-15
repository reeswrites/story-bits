// The grammar library: fork any grammar, edit your copy, share it by link, import someone else's.
// Local-first: your grammars live in this browser (localStorage). Every edit runs through
// checkGrammar before it's saved, so a grammar in the library is always one the engine can run.
// Loaded before app.js; everything here runs at call time, after app.js has set up.

const slugify = (s) => cleanWord(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "grammar";
const freshId = (name) => {
  let id;
  do { id = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`.replace(/^[^a-z]+/, "g-"); } while (GRAMMARS[id] || library[id]);
  return id;
};
const isMine = (id) => !!library[id];
// Built-in grammars carry no shared/pack flags into copies.
const plain = (g) => { const c = clone(g); delete c.shared; for (const f of Object.values(c.forms)) delete f.pack; return c; };

const lib = { editing: null, tab: "basics", slot: null, formKey: null, beatKey: null, error: "", incoming: null };

function forkGrammar(id) {
  const src = resolveGrammar(id);
  if (!src) return;
  const copy = plain(src);
  copy.name = `${src.name} (fork)`.slice(0, 40);
  copy.id = freshId(copy.name);
  copy.forkedFrom = src.id;
  library[copy.id] = copy;
  saveLibrary();
  switchGrammar(copy.id);
  openEditor(copy.id);
  toast(`Forked ${src.name}. It's yours to change.`);
}

// Apply a change to a draft of one of your grammars; save it only if the result is valid.
function editGrammar(id, mutate) {
  const draft = clone(library[id]);
  try { mutate(draft); } catch (e) { lib.error = String(e.message || e); renderLibrary(); return false; }
  const err = checkGrammar(draft);
  if (err) { lib.error = err; renderLibrary(); return false; }
  lib.error = "";
  library[id] = draft;
  saveLibrary();
  if (G.id === id) refreshActive(draft);
  renderLibrary();
  return true;
}
// The grammar in use changed under the piece: keep the piece if it still parses, else start fresh.
function refreshActive(g) {
  useGrammar(g);
  if (!FORMS[state.form]) state.form = Object.keys(FORMS)[0];
  state.len = Math.min(state.len, maxLen());
  const ok = parseSnapshot({ ...snapshot(), gx: g });
  if (!ok) {
    state.pick = {};
    for (const c of SLOTS) state.pick[c.key] = randomPhrase(c.key);
    state.beats = {};
    state.pins = [];
  }
  state.sel = null;
  renderBankForm();
  renderBank();
  renderCast();
  render();
}

function deleteGrammar(id) {
  if (!isMine(id) || !confirm(`Delete “${library[id].name}” from your library? Links that carry it will still open.`)) return;
  delete library[id];
  saveLibrary();
  if (G.id === id) switchGrammar("story-bits");
  if (lib.editing === id) lib.editing = null;
  renderLibrary();
}

const grammarLink = (g) => `${location.origin}${location.pathname}#grammar=${b64(JSON.stringify(plain(g)))}`;
function suggestGrammarLink(g) {
  const pack = { name: g.name, grammars: { [g.id]: plain(g) } };
  const body = `A grammar suggested from Story Bits for everyone.\n\nA maintainer adds the \`accepted-pack\` label to turn this into a pull request.\n\n\`\`\`json\n${JSON.stringify(pack)}\n\`\`\`\n`;
  return `${REPO}/issues/new?${new URLSearchParams({ title: `Grammar: ${g.name}`, labels: "word-pack", body })}`;
}

// A #grammar= link: check it, then offer it (never added without asking).
function receiveGrammar(data) {
  try {
    const g = JSON.parse(unb64(data));
    const err = checkGrammar(g);
    if (err) { toast(`That grammar link doesn't check out: ${err}.`); return; }
    lib.incoming = g;
  } catch { toast("That grammar link couldn't be read."); }
}
function acceptIncoming(use) {
  const g = clone(lib.incoming);
  lib.incoming = null;
  const same = resolveGrammar(g.id);
  if (same && JSON.stringify(plain(same)) === JSON.stringify(g)) { if (use) switchGrammar(g.id); renderLibrary(); return; }
  if (same) { g.forkedFrom = g.forkedFrom || g.id; g.id = freshId(g.name); }
  library[g.id] = g;
  saveLibrary();
  toast(`Added “${g.name}” to your library.`);
  if (use) switchGrammar(g.id);
  renderLibrary();
}

function openEditor(id) {
  lib.editing = id;
  lib.error = "";
  const g = library[id];
  lib.slot = lib.slot && g.schemas[lib.slot.split(".")[0]] ? lib.slot : `${g.cards[0].key}.n`;
  lib.formKey = g.forms[lib.formKey] ? lib.formKey : Object.keys(g.forms)[0];
  lib.beatKey = null;
  renderLibrary();
  $("#lib-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- rendering ----------
function renderLibrary() {
  const list = $("#lib-list");
  if (!list) return;
  const card = (g) => {
    const mine = isMine(g.id);
    const from = g.forkedFrom ? resolveGrammar(g.forkedFrom)?.name || g.forkedFrom : "";
    const tags = [mine ? "yours" : g.shared ? "shared" : "built in", from && `forked from ${from}`, ...(g.rules.constraints || []).map(describeConstraint)].filter(Boolean);
    return `<article class="gram${g.id === G.id ? " active" : ""}">
      <header><h3>${esc(g.name)}</h3><span class="count">${esc(tags[0])}</span></header>
      <p class="gram-desc">${esc(g.description || "")}</p>
      ${tags.length > 1 ? `<p class="gram-tags">${tags.slice(1).map((t) => `<span>${esc(t)}</span>`).join("")}</p>` : ""}
      <p class="gram-meta">${g.cards.map((c) => esc(c.label)).join(" · ")} — ${Object.keys(g.forms).length} form${Object.keys(g.forms).length === 1 ? "" : "s"}</p>
      <div class="person-actions">
        ${g.id === G.id ? `<span class="crown">in use</span>` : `<button class="ghost" data-lib-use="${esc(g.id)}">Use</button>`}
        <button class="ghost" data-lib-fork="${esc(g.id)}">Fork</button>
        <button class="ghost" data-lib-share="${esc(g.id)}">Copy link</button>
        ${mine ? `<button class="ghost" data-lib-edit="${esc(g.id)}">${lib.editing === g.id ? "Editing" : "Edit"}</button>
        <button class="ghost" data-lib-suggest="${esc(g.id)}">Suggest ↗</button>
        <button class="ghost subtle" data-lib-delete="${esc(g.id)}">Delete</button>` : ""}
      </div>
    </article>`;
  };
  list.innerHTML = allGrammars().map(card).join("");

  const inc = $("#lib-incoming");
  if (lib.incoming) {
    inc.hidden = false;
    inc.innerHTML = `<p><b>Someone shared a grammar: “${esc(lib.incoming.name)}”.</b> ${esc(lib.incoming.description || "")}</p>
      <p class="gram-meta">${lib.incoming.cards.map((c) => esc(c.label)).join(" · ")} — ${Object.keys(lib.incoming.forms).length} forms</p>
      <div class="cp-row"><button class="primary" data-lib-accept="use">Add and use it</button><button class="ghost" data-lib-accept="add">Add to my library</button><button class="ghost subtle" data-lib-accept="no">No thanks</button></div>`;
  } else inc.hidden = true;

  const ed = $("#lib-editor");
  if (!lib.editing || !library[lib.editing]) { ed.hidden = true; return; }
  ed.hidden = false;
  ed.innerHTML = editorHtml(library[lib.editing]);
}

const TABS = [["basics", "Basics"], ["words", "Words"], ["forms", "Beats"], ["rules", "Rules"], ["json", "JSON"]];
function editorHtml(g) {
  const tabs = `<div class="lib-tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" aria-selected="${lib.tab === k}" data-lib-tab="${k}">${n}</button>`).join("")}</div>`;
  const err = lib.error ? `<p class="bf-error" role="alert">Not saved: ${esc(lib.error)}</p>` : "";
  let body = "";
  if (lib.tab === "basics") body = `
    <label class="bf-field"><span class="dial-label">Name</span><input data-lib-field="name" value="${esc(g.name)}" maxlength="40"></label>
    <label class="bf-field"><span class="dial-label">Description</span><textarea data-lib-field="description" rows="3" maxlength="400">${esc(g.description || "")}</textarea></label>
    <label class="bf-field"><span class="dial-label">Headline label</span><input data-lib-field="headline" value="${esc(g.headline || "")}" maxlength="30" placeholder="The line"></label>
    <label class="bf-field"><span class="dial-label">Headline template</span><input data-lib-field="line" value="${esc(g.line)}" maxlength="200"></label>
    <p class="bf-hint">Cards: ${g.cards.map((c) => `<code>{${esc(c.key)}}</code>`).join(" ")}${g.pronouns ? `; pronouns: ${PRONOUN_TOKENS.map((t) => `<code>{${t}}</code>`).join(" ")}` : ""}. Changes save when you leave a field.</p>`;
  else if (lib.tab === "words") {
    const [s, k] = lib.slot.split(".");
    const part = g.schemas[s]?.parts.find((p) => p.k === k);
    const slots = g.cards.map((c) => `<optgroup label="${esc(c.label)}">${g.schemas[c.key].parts.map((p) => `<option value="${c.key}.${p.k}" ${lib.slot === `${c.key}.${p.k}` ? "selected" : ""}>${esc(c.label)}: ${esc(p.name)}</option>`).join("")}</optgroup>`).join("");
    body = `<label class="bf-field"><span class="dial-label">Slot</span><select data-lib-slot>${slots}</select></label>
      <p class="bf-hint">${esc(part?.hint || "")}${part?.opt ? " Optional slot." : " Required slot: keep at least one word."}</p>
      <div class="lib-words">${(part?.pool || []).map((w, i) => `<span class="bank-word t${w.tier}${entryAllowed(w, g) ? "" : " filtered"}" title="${TIER_NAMES[w.tier]}${w.v !== undefined ? ` · ${MOOD_NAMES[w.v]}` : ""}${entryAllowed(w, g) ? "" : " · filtered out by this grammar's constraints"}">${w.det ? `<span class="bw-slot">${esc(w.det)}</span>` : ""}${esc(w.t)}<button class="bw-x" data-lib-unword="${i}" aria-label="Remove ${esc(w.t)}">✕</button></span>`).join("")}</div>
      <form class="lib-add" data-lib-addword>
        <input name="t" maxlength="60" placeholder="a new word for ${esc(part?.name || "this slot")}">
        <select name="tier">${TIER_NAMES.map((n, i) => `<option value="${i}">${n}</option>`).join("")}</select>
        ${part?.mood ? `<select name="v"><option value="1">good</option><option value="0" selected>mixed</option><option value="-1">bad</option></select>` : ""}
        ${part?.det ? `<select name="det">${part.det.map((d) => `<option>${esc(d)}</option>`).join("")}</select>` : ""}
        ${part?.pronouns ? `<select name="pr"><option value="they">they</option><option value="she">she</option><option value="he">he</option></select>` : ""}
        <button class="primary">Add</button>
      </form>`;
  } else if (lib.tab === "forms") {
    const f = g.forms[lib.formKey];
    const beatKeys = Object.keys(f.beats);
    const bk = beatKeys.includes(lib.beatKey) ? lib.beatKey : beatKeys[0];
    const b = bk && f.beats[bk];
    const pools = b ? (b.byMood ? [["1", "good"], ["0", "mixed"], ["-1", "bad"]].map(([m, n]) => [m, n, b.lines[m]]) : [[null, "", b.lines]]) : [];
    body = `<div class="cp-row">
        <label class="bf-field"><span class="dial-label">Form</span><select data-lib-form>${Object.entries(g.forms).map(([k, x]) => `<option value="${esc(k)}" ${k === lib.formKey ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
        ${bk ? `<label class="bf-field"><span class="dial-label">Beat</span><select data-lib-beat>${beatKeys.map((k) => `<option value="${esc(k)}" ${k === bk ? "selected" : ""}>${esc(f.beats[k].name)}${f.beats[k].role === "landing" ? " (landing)" : ""}</option>`).join("")}</select></label>` : ""}
        <button class="ghost" data-lib-dupform="${esc(lib.formKey)}">Duplicate form</button>
      </div>
      ${b ? pools.map(([m, n, lines]) => `${n ? `<h4 class="dial-label">${n} mood</h4>` : ""}<ol class="lib-lines">${lines.map((l, i) => `<li class="t${l.tier}"><span class="tier t${l.tier}">${TIER_NAMES[l.tier]}</span> ${esc(l.t)} <button class="bw-x" data-lib-unline="${i}" data-mood="${m ?? ""}" aria-label="Remove line">✕</button></li>`).join("")}</ol>
        <form class="lib-add" data-lib-addline data-mood="${m ?? ""}"><input name="t" maxlength="200" placeholder="a new line; use {${esc(g.cards[g.cards.length - 1].key)}} for a card"><select name="tier">${TIER_NAMES.map((x, i) => `<option value="${i}">${x}</option>`).join("")}</select><button class="primary">Add</button></form>`).join("") : `<p class="empty">This form has no beats. Stanzas and beats can be added in JSON.</p>`}
      <p class="bf-hint">Stanzas (which beats each length uses) are edited in JSON. ${g.rules.landing ? "This grammar's forms must land: every stanza's last paragraph needs a landing beat." : ""}</p>`;
  } else if (lib.tab === "rules") {
    const cs = g.rules.constraints || [];
    const has = (t) => cs.find((c) => c.type === t);
    body = `<h4 class="dial-label">Constraints</h4>
      <p class="bf-hint">Restrict which words the grammar offers. Shuffles and the picker only draw from words that pass. A required slot with no passing words keeps its whole list.</p>
      <div class="lib-cons">
        <label><input type="checkbox" data-lib-con="lipogram" ${has("lipogram") ? "checked" : ""}> Lipogram: no letters <input data-lib-conval="lipogram" value="${esc(has("lipogram")?.letters ?? "e")}" maxlength="6" size="4"></label>
        <label><input type="checkbox" data-lib-con="startsWith" ${has("startsWith") ? "checked" : ""}> Alliteration: every word starts with <input data-lib-conval="startsWith" value="${esc(has("startsWith")?.letter ?? "s")}" maxlength="1" size="2"></label>
        <label><input type="checkbox" data-lib-con="maxSyllables" ${has("maxSyllables") ? "checked" : ""}> Short words: at most <input data-lib-conval="maxSyllables" type="number" min="1" max="6" value="${has("maxSyllables")?.n ?? 2}"> syllables</label>
        <label><input type="checkbox" data-lib-con="closed" ${has("closed") ? "checked" : ""}> Closed: only this grammar's own words, no word bank</label>
      </div>
      <h4 class="dial-label">The dial</h4>
      <label class="bf-field"><span class="dial-label">Dial name</span><input data-lib-rule="dialName" value="${esc(g.rules.dialName || "")}" maxlength="30"></label>
      <div class="cp-row">${[0, 1, 2].map((i) => `<label class="bf-field"><span class="dial-label">Setting ${i + 1}</span><input data-lib-label="${i}" value="${esc(g.rules.dialLabels[i])}" maxlength="20"></label>`).join("")}</div>
      <p class="bf-hint">Pairs that fit or clash (setting 1: none clash; 2: the first; 3: all):</p>
      <ol class="lib-lines">${g.rules.pairs.map((p, i) => `<li>${esc(g.cards.find((c) => c.key === p.a)?.label)} ↔ ${esc(g.cards.find((c) => c.key === p.b)?.label)} on ${esc(p.on)} <button class="bw-x" data-lib-unpair="${i}" aria-label="Remove pair">✕</button></li>`).join("")}</ol>
      <form class="lib-add" data-lib-addpair>
        <select name="a">${g.cards.map((c) => `<option value="${esc(c.key)}">${esc(c.label)}</option>`).join("")}</select>
        <select name="b">${g.cards.map((c, i) => `<option value="${esc(c.key)}" ${i === 1 ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
        <select name="on"><option value="register">register</option><option value="sound">sound</option><option value="mood">mood</option></select>
        <button class="primary">Add pair</button>
      </form>
      <label class="lib-check"><input type="checkbox" data-lib-landing ${g.rules.landing ? "checked" : ""}> Every form must land (the humor rule)</label>`;
  } else if (lib.tab === "json") body = `
    <p class="bf-hint">The whole grammar. Anything the other tabs can't do (cards, slots, stanzas, nesting) is here. Apply checks it first.</p>
    <textarea id="lib-json" rows="18" spellcheck="false">${esc(JSON.stringify(g, null, 1))}</textarea>
    <div class="cp-row"><button class="primary" data-lib-applyjson>Apply</button></div>`;
  return `<div class="lib-head"><h3>Editing “${esc(g.name)}”</h3><button class="pk-x" data-lib-close aria-label="Close editor">✕</button></div>${tabs}${err}<div class="lib-body">${body}</div>`;
}

// ---------- events ----------
document.addEventListener("click", (e) => {
  if (!(e.target instanceof Element)) return;
  const t = e.target.closest("button");
  if (!t || !t.closest("#library")) return;
  const d = t.dataset;
  const id = lib.editing;
  if (d.libUse) switchGrammar(d.libUse);
  else if (d.libFork) forkGrammar(d.libFork);
  else if (d.libShare) { const g = resolveGrammar(d.libShare); copy(grammarLink(g), `Link to “${g.name}” copied. Whoever opens it can add it to their library.`); }
  else if (d.libEdit) openEditor(d.libEdit);
  else if (d.libDelete) deleteGrammar(d.libDelete);
  else if (d.libSuggest) { const url = suggestGrammarLink(library[d.libSuggest]); if (url.length > 7500) toast("This grammar is too big to suggest in an issue. Share its link instead."); else window.open(url, "_blank", "noopener"); }
  else if (d.libAccept) { if (d.libAccept === "no") { lib.incoming = null; renderLibrary(); } else acceptIncoming(d.libAccept === "use"); }
  else if (d.libClose !== undefined) { lib.editing = null; renderLibrary(); }
  else if (d.libTab) { lib.tab = d.libTab; lib.error = ""; renderLibrary(); }
  else if (d.libUnword !== undefined) editGrammar(id, (g) => { const [s, k] = lib.slot.split("."); g.schemas[s].parts.find((p) => p.k === k).pool.splice(+d.libUnword, 1); });
  else if (d.libUnline !== undefined) editGrammar(id, (g) => { const b = g.forms[lib.formKey].beats[lib.beatKey || Object.keys(g.forms[lib.formKey].beats)[0]]; (d.mood ? b.lines[d.mood] : b.lines).splice(+d.libUnline, 1); });
  else if (d.libUnpair !== undefined) editGrammar(id, (g) => { g.rules.pairs.splice(+d.libUnpair, 1); });
  else if (d.libDupform) editGrammar(id, (g) => { const k = `${d.libDupform}-copy`.slice(0, 20).replace(/-+$/, ""); let key = k, i = 2; while (g.forms[key]) key = `${k}${i++}`; g.forms[key] = { ...clone(g.forms[d.libDupform]), name: `${g.forms[d.libDupform].name} (copy)`.slice(0, 40) }; lib.formKey = key; });
  else if (d.libApplyjson !== undefined) {
    let next;
    try { next = JSON.parse($("#lib-json").value); } catch (err) { lib.error = `JSON: ${err.message}`; renderLibrary(); return; }
    editGrammar(id, (g) => { for (const k of Object.keys(g)) delete g[k]; Object.assign(g, next, { id }); });
    if (!lib.error) toast("Grammar updated.");
  }
});

document.addEventListener("submit", (e) => {
  const f = e.target;
  if (!(f instanceof HTMLFormElement) || !f.closest("#library")) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const id = lib.editing;
  const v = (n) => f.elements[n]?.value;
  if (f.dataset.libAddword !== undefined) {
    const [s, k] = lib.slot.split(".");
    const t = cleanWord(v("t"));
    if (!t) return;
    editGrammar(id, (g) => {
      const part = g.schemas[s].parts.find((p) => p.k === k);
      const w = { t, tier: +v("tier"), ...(part.mood && { v: +v("v") }), ...(part.det && { det: v("det") }), ...(part.pronouns && PRON[v("pr")]) };
      if (part.pool.some((x) => x.t.toLowerCase() === t.toLowerCase())) throw new Error("that word is already here");
      part.pool.push(w);
    });
  } else if (f.dataset.libAddline !== undefined) {
    const t = String(v("t") || "").trim();
    if (!t) return;
    editGrammar(id, (g) => { const fm = g.forms[lib.formKey]; const b = fm.beats[lib.beatKey || Object.keys(fm.beats)[0]]; (f.dataset.mood ? b.lines[f.dataset.mood] : b.lines).push({ tier: +v("tier"), t }); });
  } else if (f.dataset.libAddpair !== undefined) {
    editGrammar(id, (g) => { g.rules.pairs.push({ a: v("a"), b: v("b"), on: v("on"), label: `${g.cards.find((c) => c.key === v("a")).label.toLowerCase()} ↔ ${g.cards.find((c) => c.key === v("b")).label.toLowerCase()}` }); });
  }
}, true);

document.addEventListener("change", (e) => {
  const el = e.target;
  if (!(el instanceof Element) || !el.closest("#library")) return;
  const id = lib.editing;
  const d = el.dataset;
  if (d.libSlot !== undefined) { lib.slot = el.value; renderLibrary(); }
  else if (d.libForm !== undefined) { lib.formKey = el.value; lib.beatKey = null; renderLibrary(); }
  else if (d.libBeat !== undefined) { lib.beatKey = el.value; renderLibrary(); }
  else if (d.libField) editGrammar(id, (g) => { const val = d.libField === "line" ? el.value : cleanWord(el.value) || (d.libField === "name" ? g.name : ""); if (val) g[d.libField] = val; else delete g[d.libField]; });
  else if (d.libRule) editGrammar(id, (g) => { g.rules[d.libRule] = cleanWord(el.value); });
  else if (d.libLabel !== undefined) editGrammar(id, (g) => { g.rules.dialLabels[+d.libLabel] = cleanWord(el.value) || g.rules.dialLabels[+d.libLabel]; });
  else if (d.libLanding !== undefined) editGrammar(id, (g) => { g.rules.landing = el.checked; });
  else if (d.libCon || d.libConval) {
    editGrammar(id, (g) => {
      const box = (t) => document.querySelector(`[data-lib-con="${t}"]`);
      const val = (t) => document.querySelector(`[data-lib-conval="${t}"]`)?.value;
      const cs = [];
      if (box("lipogram").checked && cleanWord(val("lipogram"))) cs.push({ type: "lipogram", letters: cleanWord(val("lipogram")).toLowerCase().replace(/[^a-z]/g, "") });
      if (box("startsWith").checked && /^[a-z]$/i.test(val("startsWith"))) cs.push({ type: "startsWith", letter: val("startsWith").toLowerCase() });
      if (box("maxSyllables").checked) cs.push({ type: "maxSyllables", n: Math.max(1, Math.min(6, +val("maxSyllables") || 2)) });
      if (box("closed").checked) cs.push({ type: "closed" });
      if (cs.length) g.rules.constraints = cs; else delete g.rules.constraints;
    });
  }
});
