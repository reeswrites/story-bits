// Everything from a grammar reaches the page escaped: text, attributes, pronouns.
import { test } from "node:test";
import assert from "node:assert/strict";
import { engine } from "./load.mjs";

test("esc() escapes everything that matters in text and attributes", () => {
  assert.equal(engine().json(`esc(\`<a href="x" title='y'>&</a>\`)`), "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
});

test("fill() escapes the template's own text and the pronouns", () => {
  const r = engine().json(`(() => {
    fresh("story-bits", "bit", 2, 1, 3);
    const ctx = context();
    const evil = { ...ctx, pr: { p: "<i>he</i>", o: "<o>", pos: "\\"his\\"", is: "'is", has: "has", was: "was", s: "s" } };
    return {
      html: fill('Tom & <b>Jerry</b> "quote" {p} {o} {pos} {is} {P}, {who}.', evil),
      whoHtml: phraseHtml("who"),
      text: fillText("Tom & Jerry {who}.", ctx),
    };
  })()`);
  assert.ok(!/<b>|<i>|<o>/.test(r.html), r.html);
  assert.match(r.html, /Tom &amp; &lt;b&gt;Jerry&lt;\/b&gt; &quot;quote&quot;/);
  assert.match(r.html, /&lt;i&gt;he&lt;\/i&gt; &lt;o&gt; &quot;his&quot; &#39;is &lt;i&gt;he&lt;\/i&gt;/);
  assert.ok(r.html.includes(r.whoHtml), "cards come from phraseHtml");
  assert.match(r.text, /^Tom & Jerry /, "plain text isn't escaped");
});

// A grammar that skipped checkGrammar (as if a check were missed): markup in words, beat lines,
// the headline, and quotes in the names that land in attributes.
const RAW = `(() => {
  const g = clone(GRAMMARS["small-poems"]);
  g.id = "raw";
  const hostile = "\\" onfocus=alert(1) x='";
  for (const c of g.cards) {
    c.label += hostile;
    for (const p of g.schemas[c.key].parts) {
      p.name += hostile;
      for (const w of p.pool) if (!/\\{/.test(w.t)) w.t = "<img src=x onerror=alert(1)> \\"" + w.t;
    }
  }
  for (const f of Object.values(g.forms)) for (const b of Object.values(f.beats)) {
    b.name += hostile;
    for (const pool of b.byMood ? Object.values(b.lines) : [b.lines]) for (const l of pool) l.t = "<script>" + l.t;
  }
  g.line = "<b>" + g.line;
  return g;
})()`;

test("words, lines and names reach the page escaped, even from an unchecked grammar", () => {
  const html = engine().json(`(() => {
    fresh(${RAW}, undefined, 3, 2, 1);
    const ctx = context();
    let out = bitHtml(ctx) + story(ctx).join("");
    // Every word and beat selected in turn, so ghosts ("add a …") and selected states render too.
    for (const c of SLOTS) walk(c.key, state.pick[c.key], (s, part, ph, depth, path) => { state.sel = { slot: c.key, path, occ: 0 }; out += phraseHtml(c.key); });
    for (const key of stanza().paras.flat()) { state.sel = { beat: key }; state.pins = ["beat|" + key]; out += story(ctx).join(""); }
    state.sel = null;
    return out + staticHtml(fixedSnapshot(), ["beat|" + stanza().paras.flat()[0]]);
  })()`);
  assert.ok(!/<img|<script|<b>/.test(html), "raw markup reached the page");
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt; &quot;/);
  // Names in attributes can't close the attribute.
  assert.ok(!/" onfocus=|' onfocus=/.test(html), "a quote in a name broke out of an attribute");
  assert.match(html, /&quot; onfocus=alert\(1\) x=&#39;/);
  assert.ok(html.includes("ghost-slot"), "no ghost slots rendered");
});
