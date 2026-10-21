// Injected auto-fill script. Plain classic script, no dependencies, safe to load twice.
// It only touches the page through the DOM, the way a bookmarklet or userscript would.
(function (root) {
  'use strict';

  const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

  // Pure: decide which picker row to click. Names are not unique, so department breaks ties.
  function matchRow(rows, want) {
    const name = normalize(want.name);
    const sameName = rows.filter((r) => normalize(r.name) === name);
    if (sameName.length === 0) return { status: 'missing' };
    if (sameName.length === 1) return { status: 'matched', row: sameName[0] };
    const dept = normalize(want.department);
    const sameDept = dept ? sameName.filter((r) => normalize(r.department) === dept) : [];
    return sameDept.length === 1 ? { status: 'matched', row: sameDept[0] } : { status: 'ambiguous', count: sameName.length };
  }

  const exported = { normalize, matchRow };
  root.HelpdeskAutofill = Object.assign(root.HelpdeskAutofill || {}, exported);
  if (typeof document === 'undefined' || root.HelpdeskAutofill.mounted) return;
  root.HelpdeskAutofill.mounted = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(check, { timeout = 4000, interval = 50 } = {}) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const value = check();
      if (value) return value;
      await sleep(interval);
    }
    return null;
  }

  // Frameworks that keep state in JS only see changes that arrive as events.
  function setText(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setSelect(el, value) {
    const option = [...el.options].find((o) => normalize(o.textContent) === normalize(value));
    if (!option) return false;
    el.value = option.value || option.textContent;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value === (option.value || option.textContent);
  }

  const readRows = (list) =>
    [...list.querySelectorAll('li')].map((el) => ({
      el,
      name: el.children[0]?.textContent ?? '',
      department: el.children[1]?.textContent ?? '',
    }));

  // The pickers have no search box and lazy-load pages on scroll, so the only way
  // to find a user is to open the list, scan, scroll to the bottom, and wait for more rows.
  async function pickUser(pickerEl, want) {
    pickerEl.querySelector('.picker-trigger').click();
    const dialog = await waitFor(() => {
      const d = pickerEl.querySelector('[role=dialog]');
      return d && !d.hidden ? d : null;
    });
    if (!dialog) return { ok: false, reason: 'picker did not open' };
    const list = dialog.querySelector('.picker-list');
    const close = () => dialog.querySelector('.picker-close').click();

    for (let pass = 0; pass < 30; pass++) {
      await waitFor(() => list.querySelectorAll('li').length > 0);
      const rows = readRows(list);
      const result = matchRow(rows, want);
      if (result.status === 'matched') {
        result.row.el.click();
        return (await waitFor(() => dialog.hidden)) ? { ok: true } : { ok: false, reason: 'selection did not close the picker' };
      }
      if (result.status === 'ambiguous') {
        close();
        return { ok: false, reason: `${result.count} users share this name` };
      }
      list.scrollTop = list.scrollHeight;
      // Scroll events are frame-driven and can be delayed or skipped in a background tab,
      // so emit one explicitly. The page's own handler ignores duplicates while a load is in flight.
      list.dispatchEvent(new Event('scroll'));
      const grew = await waitFor(() => list.querySelectorAll('li').length > rows.length, { timeout: 3000 });
      if (!grew) break;
    }
    close();
    return { ok: false, reason: 'not found in user list' };
  }

  // ---- UI: lives in a shadow root so the host page's CSS cannot restyle it ----
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647';
  const ui = host.attachShadow({ mode: 'open' });
  ui.innerHTML = `
    <style>
      .panel { width: 340px; padding: 12px; font: 13px/1.4 system-ui, sans-serif; color: #1d2433; background: #fff; border: 1px solid #98a2b3; border-radius: 8px; box-shadow: 0 8px 24px rgb(0 0 0 / 20%); }
      h3 { margin: 0 0 8px; font-size: 14px; }
      textarea, select { width: 100%; box-sizing: border-box; font: inherit; }
      textarea { height: 150px; margin: 6px 0; }
      button { padding: 6px 12px; font: inherit; cursor: pointer; }
      ul { margin: 8px 0 0; padding: 0; list-style: none; }
      li { padding: 2px 0; } .ok::before { content: '✓ '; color: #067647; } .warn::before { content: '⚠ '; color: #b54708; }
      .meta { color: #667085; font-size: 12px; }
    </style>
    <div class="panel">
      <h3>Ticket auto-fill</h3>
      <select id="sample"><option value="">Load sample email…</option></select>
      <textarea id="email" placeholder="Paste the fault email here"></textarea>
      <button id="run">Fill form</button> <span id="mode" class="meta"></span>
      <ul id="log"></ul>
    </div>`;
  document.body.append(host);

  const $ = (id) => ui.getElementById(id);
  const log = (kind, text) => {
    const li = document.createElement('li');
    li.className = kind;
    li.textContent = text;
    $('log').append(li);
  };

  fetch('/api/examples').then((r) => r.json()).then(({ mode, items }) => {
    $('mode').textContent = `triage: ${mode}`;
    for (const item of items) $('sample').add(new Option(item.name, item.text));
  });
  $('sample').addEventListener('change', (e) => { $('email').value = e.target.value; });

  const fields = {
    subsystem: (el, v) => setSelect(el, v),
    region: (el, v) => setSelect(el, v),
    priority: (el, v) => setSelect(el, v),
    summary: (el, v) => { setText(el, v); return true; },
  };

  $('run').addEventListener('click', async () => {
    $('log').replaceChildren();
    const email = $('email').value;
    if (!email.trim()) return log('warn', 'Paste an email first');
    $('run').disabled = true;
    try {
      const res = await fetch('/api/triage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);

      for (const [key, apply] of Object.entries(fields)) {
        const el = document.querySelector(`[data-field="${key}"]`);
        if (!data[key] || data[key] === 'Unknown') { log('warn', `${key}: not determined, left empty`); continue; }
        log(apply(el, data[key]) ? 'ok' : 'warn', `${key}: ${data[key]}`);
      }
      setText(document.querySelector('[data-field="description"]'), email.trim());

      for (const key of ['caller', 'assignee', 'regional_contact']) {
        const want = data[key];
        // Never leave a value from a previous run behind: a stale caller is worse than an empty one.
        const clear = document.querySelector(`[data-picker="${key}"] .picker-clear`);
        if (clear && !clear.hidden) clear.click();
        if (!want) { log('warn', `${key}: not determined, left empty`); continue; }
        const outcome = await pickUser(document.querySelector(`[data-picker="${key}"]`), want);
        log(outcome.ok ? 'ok' : 'warn', outcome.ok ? `${key}: ${want.name}` : `${key}: ${want.name} – ${outcome.reason}`);
      }
    } catch (err) {
      log('warn', err.message);
    } finally {
      $('run').disabled = false;
    }
  });
})(globalThis);
