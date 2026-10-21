// The demo "helpdesk" form. It deliberately behaves like a real ticketing UI:
//  - field values live in a JS state object that is updated by input/change events,
//    so assigning element.value from outside is not enough;
//  - the user pickers have no search box: a dialog lists users 20 at a time and
//    loads the next page when the list is scrolled to the bottom.

const PAGE_SIZE = 20;
const state = { subsystem: '', region: '', priority: '', summary: '', description: '', caller: null, assignee: null, regional_contact: null };

const form = document.querySelector('#ticket');
const errors = document.querySelector('#errors');
let nextTicket = 1001;

for (const el of form.querySelectorAll('[data-field]')) {
  const sync = () => { state[el.dataset.field] = el.value; };
  el.addEventListener('input', sync);
  el.addEventListener('change', sync);
}

function setupPicker(root) {
  const field = root.dataset.picker;
  const trigger = root.querySelector('.picker-trigger');
  const dialog = document.createElement('div');
  dialog.className = 'picker-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.hidden = true;
  dialog.innerHTML = `
    <div class="picker-head"><span>Select user</span><button type="button" class="picker-close" aria-label="Close">×</button></div>
    <ul class="picker-list" role="listbox" tabindex="0"></ul>
    <div class="picker-status"></div>`;
  root.append(dialog);

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'picker-clear';
  clear.textContent = 'Clear';
  clear.hidden = true;
  root.append(clear);
  clear.addEventListener('click', () => {
    state[field] = null;
    trigger.textContent = 'Select user…';
    trigger.classList.remove('set');
    clear.hidden = true;
  });

  const list = dialog.querySelector('.picker-list');
  const status = dialog.querySelector('.picker-status');
  let next = 0;
  let loading = false;

  async function loadPage() {
    if (loading || next === null) return;
    loading = true;
    status.textContent = 'Loading…';
    const res = await fetch(`/api/users?offset=${next}&limit=${PAGE_SIZE}`);
    const page = await res.json();
    for (const user of page.users) {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.dataset.userId = user.id;
      li.innerHTML = '<span></span><small></small>';
      li.firstChild.textContent = user.name;
      li.lastChild.textContent = user.department;
      li.addEventListener('click', () => choose(user));
      list.append(li);
    }
    next = page.next;
    status.textContent = next === null ? 'End of list' : '';
    loading = false;
  }

  function choose(user) {
    state[field] = user;
    trigger.textContent = `${user.name} (${user.department})`;
    trigger.classList.add('set');
    clear.hidden = false;
    close();
  }

  function close() { dialog.hidden = true; }

  trigger.addEventListener('click', () => {
    dialog.hidden = !dialog.hidden;
    if (!dialog.hidden && list.children.length === 0) loadPage();
  });
  dialog.querySelector('.picker-close').addEventListener('click', close);
  list.addEventListener('scroll', () => {
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 8) loadPage();
  });
}

document.querySelectorAll('[data-picker]').forEach(setupPicker);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const missing = ['subsystem', 'region', 'priority', 'summary', 'assignee']
    .filter((k) => !state[k]);
  errors.hidden = missing.length === 0;
  errors.textContent = missing.length ? `Missing required fields: ${missing.join(', ')}` : '';
  if (missing.length) return;
  const ticket = { id: `HD-${nextTicket++}`, ...state, caller: state.caller?.name ?? null, assignee: state.assignee.name, regional_contact: state.regional_contact?.name ?? null };
  const result = document.querySelector('#result');
  result.querySelector('pre').textContent = JSON.stringify(ticket, null, 2);
  result.hidden = false;
});

// Dev-only: loads the auto-fill script the same way the bookmarklet does.
document.querySelector('#inject').addEventListener('click', () => {
  const s = document.createElement('script');
  s.src = '/autofill.js';
  document.body.append(s);
});
