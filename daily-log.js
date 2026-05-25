  const DEFAULT_BLOCKS = [
    { key: 'deep-work', label: 'Deep work', planned: 90 },
    { key: 'exercise',  label: 'Exercise',  planned: 45 },
    { key: 'reading',   label: 'Reading',   planned: 30 },
    { key: 'learning',  label: 'Learning',  planned: 30 },
  ];

  const SNAP = 5;
  const MAX = 240;
  const STORAGE_KEY = 'daily-log-state-v2';
  const BLOCKS_KEY = 'daily-log-blocks-v1';
  const NOTES_KEY = 'daily-log-notes-v1';
  const HISTORY_KEY = 'daily-log-history-v1';

  const DEFAULT_NOTES = [
    { key: 'shipped', label: 'What shipped today (main work)?', placeholder: '' },
    { key: 'outcome', label: 'Outcome moving a goal forward',    placeholder: '' },
    { key: 'blocker', label: 'Blocker for tomorrow',              placeholder: '' },
    { key: 'notes',   label: 'Notes (optional)',                  placeholder: '' },
  ];

  const blocksEl = document.getElementById('blocks');
  const notesEl = document.getElementById('notes');
  const dateEl = document.getElementById('date');
  const previewEl = document.getElementById('preview');
  const toastEl = document.getElementById('toast');

  let fileHandle = null;
  let activeTimer = null; // { key, startedAt }
  let tickInterval = null;
  let draggingKey = null;
  let BLOCKS = loadBlocks() || JSON.parse(JSON.stringify(DEFAULT_BLOCKS));
  let NOTES = loadNotes() || JSON.parse(JSON.stringify(DEFAULT_NOTES));

  // --- date ---
  const today = new Date();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;
  const dateStr = `${todayKey} (${days[today.getDay()]})`;
  dateEl.textContent = dateStr;

  // --- block list persistence ---
  function loadBlocks() {
    try {
      const raw = localStorage.getItem(BLOCKS_KEY);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return null;
      return arr.map(b => ({ key: String(b.key), label: String(b.label), planned: parseInt(b.planned, 10) || 30 }));
    } catch (e) { return null; }
  }
  function saveBlocks() {
    try { localStorage.setItem(BLOCKS_KEY, JSON.stringify(BLOCKS)); } catch (e) {}
  }
  function genBlockKey(label) {
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
    const suffix = Math.random().toString(36).slice(2, 6);
    return (base || 'goal') + '-' + suffix;
  }

  // --- notes list persistence ---
  function loadNotes() {
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return null;
      return arr.map(n => ({
        key: String(n.key),
        label: String(n.label),
        placeholder: String(n.placeholder || ''),
      }));
    } catch (e) { return null; }
  }
  function saveNotes() {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(NOTES)); } catch (e) {}
  }
  function genNoteKey(label) {
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
    const suffix = Math.random().toString(36).slice(2, 6);
    return (base || 'note') + '-' + suffix;
  }
  function labelToMarkdown(label) {
    return label.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*[?]+\s*$/, '').trim();
  }
  function startNoteLabelEdit(card, n) {
    const labelEl = card.querySelector('.note-label');
    if (!labelEl || card.querySelector('.label-input')) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = n.label;
    input.maxLength = 100;
    input.className = 'label-input';
    labelEl.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const restore = (newLabel) => {
      if (done) return;
      done = true;
      const replacement = document.createElement('label');
      replacement.className = 'note-label editable';
      replacement.htmlFor = `note-input-${n.key}`;
      replacement.title = 'Click to rename';
      replacement.textContent = newLabel;
      replacement.addEventListener('click', () => startNoteLabelEdit(card, n));
      input.replaceWith(replacement);
    };
    const commit = () => {
      const newVal = input.value.trim();
      if (!newVal || newVal === n.label) { restore(n.label); return; }
      n.label = newVal;
      saveNotes();
      saveState();
      restore(newVal);
      showToast('Renamed');
    };
    const cancel = () => restore(n.label);
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); input.blur(); }
    });
  }
  function renderNote(n) {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.id = `note-${n.key}`;
    card.innerHTML = `
      <button class="remove-btn" title="Remove note">×</button>
      <label class="note-label editable" for="note-input-${n.key}"></label>
      <textarea id="note-input-${n.key}" rows="2"></textarea>
    `;
    const labelEl = card.querySelector('.note-label');
    labelEl.textContent = n.label;
    labelEl.title = 'Click to rename';
    labelEl.addEventListener('click', () => startNoteLabelEdit(card, n));
    const textarea = card.querySelector('textarea');
    textarea.placeholder = '';
    textarea.addEventListener('input', saveState);
    card.querySelector('.remove-btn').addEventListener('click', () => removeNote(n.key));
    notesEl.appendChild(card);
  }
  function renderAllNotes() {
    notesEl.innerHTML = '';
    NOTES.forEach(renderNote);
  }
  function addNote(label) {
    const note = { key: genNoteKey(label), label, placeholder: '' };
    NOTES.push(note);
    saveNotes();
    renderNote(note);
    saveState();
  }
  function removeNote(key) {
    const n = NOTES.find(x => x.key === key);
    if (!n) return;
    if (!confirm(`Remove "${n.label}"?`)) return;
    NOTES = NOTES.filter(x => x.key !== key);
    saveNotes();
    const card = document.getElementById(`note-${key}`);
    if (card) card.remove();
    saveState();
    showToast(`Removed "${n.label}"`);
  }

  // --- heatmap helpers ---
  function formatDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function getHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveHistory(h) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch (e) {}
  }
  function computeTodayStats() {
    let total = 0, planned = 0, goalsHit = 0;
    const goalsTotal = BLOCKS.length;
    BLOCKS.forEach(b => {
      const s = document.getElementById(`s-${b.key}`);
      let val = s ? parseInt(s.value, 10) : 0;
      if (activeTimer && activeTimer.key === b.key) {
        val += Math.floor((Date.now() - activeTimer.startedAt) / 60000);
      }
      total += val;
      planned += b.planned;
      if (b.planned > 0 && val >= b.planned) goalsHit++;
    });
    const score = planned > 0 ? Math.min(total / planned, 1.2) : 0;
    return { total, planned, score, goalsHit, goalsTotal };
  }
  // --- year heatmap (3-level: none / some / all goals) ---
  function dayLevel(entry) {
    if (!entry || !entry.total) return 0;
    if (entry.goalsTotal != null && entry.goalsTotal > 0) {
      return entry.goalsHit >= entry.goalsTotal ? 2 : 1;
    }
    // Fallback for old entries without per-goal counts
    if (entry.planned > 0 && entry.total >= entry.planned) return 2;
    return 1;
  }
  function computeYearStats() {
    const history = getHistory();
    const todayStats = computeTodayStats();
    const t = new Date(today); t.setHours(0, 0, 0, 0);
    const todayKeyStr = formatDateKey(t);
    const start = new Date(t);
    start.setDate(t.getDate() - 364);
    let active = 0, totalMin = 0, curStreak = 0, maxStreak = 0;
    for (let d = new Date(start); d <= t; d.setDate(d.getDate() + 1)) {
      const key = formatDateKey(d);
      let dayTotal = 0;
      if (key === todayKeyStr) dayTotal = todayStats.total;
      else if (history[key]) dayTotal = history[key].total || 0;
      totalMin += dayTotal;
      if (dayTotal > 0) {
        active++;
        curStreak++;
        if (curStreak > maxStreak) maxStreak = curStreak;
      } else {
        curStreak = 0;
      }
    }
    return { active, maxStreak, totalHours: (totalMin / 60).toFixed(1) };
  }
  function renderYearHeatmap() {
    const wrap = document.getElementById('yh-months-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    const history = getHistory();
    const todayStats = computeTodayStats();
    const t = new Date(today); t.setHours(0, 0, 0, 0);
    const todayKeyStr = formatDateKey(t);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // 12 month-blocks ending with this month
    const startYear = t.getFullYear();
    const startMonth = t.getMonth() - 11; // can be negative; Date constructor handles overflow

    for (let m = 0; m < 12; m++) {
      const monthDate = new Date(startYear, startMonth + m, 1);
      const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

      const blockWrap = document.createElement('div');
      blockWrap.className = 'yh-month-block-wrap';

      const block = document.createElement('div');
      block.className = 'yh-month-block';

      // 35 slots: 5 columns × 7 rows. Days 1..daysInMonth fill the first daysInMonth slots
      // (column-major via grid-auto-flow: column). Remaining slots are invisible placeholders
      // so every month-block keeps the same rectangular footprint.
      for (let i = 0; i < 35; i++) {
        const cell = document.createElement('div');
        cell.className = 'yh-cell';
        if (i >= daysInMonth) {
          cell.classList.add('placeholder');
          block.appendChild(cell);
          continue;
        }
        const day = i + 1;
        const cellDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
        if (cellDate > t) {
          cell.classList.add('future');
          cell.title = formatDateKey(cellDate);
        } else {
          const key = formatDateKey(cellDate);
          const entry = (key === todayKeyStr) ? todayStats : history[key];
          const lvl = dayLevel(entry);
          if (lvl > 0) cell.classList.add(`level-${lvl}`);
          if (key === todayKeyStr) {
            cell.classList.add('today');
            cell.id = 'yh-today';
          }
          const t1 = entry ? entry.total || 0 : 0;
          const p1 = entry ? entry.planned || 0 : 0;
          const gh = (entry && entry.goalsHit != null) ? entry.goalsHit : 0;
          const gt = (entry && entry.goalsTotal != null) ? entry.goalsTotal : 0;
          cell.title = `${key} · ${t1}/${p1}m · ${gh}/${gt} goals hit`;
        }
        block.appendChild(cell);
      }

      const label = document.createElement('div');
      label.className = 'yh-month-label';
      label.textContent = monthNames[monthDate.getMonth()];

      blockWrap.appendChild(block);
      blockWrap.appendChild(label);
      wrap.appendChild(blockWrap);
    }

    const ys = computeYearStats();
    const headline = document.getElementById('yh-active-headline');
    const mx = document.getElementById('yh-max-streak');
    const th = document.getElementById('yh-total-hours');
    if (headline) headline.textContent = ys.active;
    if (mx) mx.textContent = ys.maxStreak;
    if (th) th.textContent = ys.totalHours;
  }
  function updateYearToday() {
    const cell = document.getElementById('yh-today');
    if (!cell) { renderYearHeatmap(); return; }
    const todayStats = computeTodayStats();
    cell.classList.remove('level-1', 'level-2');
    const lvl = dayLevel(todayStats);
    if (lvl > 0) cell.classList.add(`level-${lvl}`);
    cell.title = `${formatDateKey(today)} · ${todayStats.total}/${todayStats.planned}m · ${todayStats.goalsHit}/${todayStats.goalsTotal} goals hit`;
    const ys = computeYearStats();
    const headline = document.getElementById('yh-active-headline');
    const mx = document.getElementById('yh-max-streak');
    const th = document.getElementById('yh-total-hours');
    if (headline) headline.textContent = ys.active;
    if (mx) mx.textContent = ys.maxStreak;
    if (th) th.textContent = ys.totalHours;
  }

  function startLabelEdit(card, b) {
    const labelEl = card.querySelector('.label');
    if (!labelEl || card.querySelector('.label-input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = b.label;
    input.maxLength = 60;
    input.className = 'label-input';

    labelEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const restore = (newLabel) => {
      if (done) return;
      done = true;
      const replacement = document.createElement('div');
      replacement.className = 'label editable';
      replacement.title = 'Click to rename';
      replacement.textContent = newLabel;
      replacement.addEventListener('click', () => startLabelEdit(card, b));
      input.replaceWith(replacement);
    };

    const commit = () => {
      const newVal = input.value.trim();
      if (!newVal || newVal === b.label) {
        restore(b.label);
        return;
      }
      b.label = newVal;
      saveBlocks();
      saveState();
      restore(newVal);
      showToast('Renamed');
    };

    const cancel = () => restore(b.label);

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); input.blur(); }
    });
  }

  // --- render ---
  function renderBlock(b) {
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `card-${b.key}`;
    card.draggable = true;
    card.innerHTML = `
      <button class="remove-btn" title="Remove goal">×</button>
      <div class="block-head">
        <div class="left">
          <div class="label"></div>
          <div class="planned"></div>
        </div>
        <div class="right">
          <span class="elapsed" id="el-${b.key}"></span>
          <button class="timer-btn">
            <span class="dot"></span>
            <span class="timer-label">Start</span>
          </button>
          <div class="value"><span id="v-${b.key}">0</span><span class="unit">min</span></div>
        </div>
      </div>
      <div class="row">
        <input type="range" id="s-${b.key}" min="0" max="${MAX}" step="${SNAP}" value="0" />
      </div>
      <div class="chips">
        <button class="chip" data-set="0">Skipped</button>
        <button class="chip" data-set="${Math.round(b.planned/2)}">Halfway</button>
        <button class="chip" data-set="${b.planned}">Completed</button>
        <button class="chip" data-delta="-15">−15</button>
        <button class="chip" data-delta="15">+15</button>
      </div>
      <div class="status" id="st-${b.key}">Not started</div>
    `;
    // Safe text content for label (no HTML injection)
    const labelEl = card.querySelector('.label');
    labelEl.textContent = b.label;
    labelEl.classList.add('editable');
    labelEl.title = 'Click to rename';
    labelEl.addEventListener('click', () => startLabelEdit(card, b));
    card.querySelector('.planned').textContent = `target ${b.planned}m`;
    blocksEl.appendChild(card);

    // Wire events
    const slider = card.querySelector(`#s-${b.key}`);
    slider.addEventListener('input', () => {
      updateBlock(b.key);
      saveState();
    });

    card.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (activeTimer && activeTimer.key === b.key) return;
        if (chip.dataset.set !== undefined) {
          slider.value = chip.dataset.set;
        } else if (chip.dataset.delta !== undefined) {
          const cur = parseInt(slider.value, 10);
          slider.value = Math.max(0, Math.min(MAX, cur + parseInt(chip.dataset.delta, 10)));
        }
        updateBlock(b.key);
        saveState();
      });
    });

    card.querySelector('.timer-btn').addEventListener('click', () => {
      if (activeTimer && activeTimer.key === b.key) {
        stopTimer();
      } else {
        startTimer(b.key);
      }
    });

    card.querySelector('.remove-btn').addEventListener('click', () => removeBlock(b.key));

    // Drag to reorder — drag the whole card, but ignore interactive controls
    card.addEventListener('dragstart', (e) => {
      if (e.target.closest('button, input, textarea, .label-input, .label.editable')) {
        e.preventDefault();
        return;
      }
      draggingKey = b.key;
      card.classList.add('dragging');
      try { e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
      try { e.dataTransfer.setData('text/plain', b.key); } catch (err) {}
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.card.drag-over-top, .card.drag-over-bottom').forEach(c => {
        c.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      draggingKey = null;
    });
    card.addEventListener('dragover', (e) => {
      if (!draggingKey || draggingKey === b.key) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
      const rect = card.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height / 2;
      card.classList.toggle('drag-over-top', above);
      card.classList.toggle('drag-over-bottom', !above);
    });
    card.addEventListener('dragleave', (e) => {
      if (!card.contains(e.relatedTarget)) {
        card.classList.remove('drag-over-top', 'drag-over-bottom');
      }
    });
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over-top', 'drag-over-bottom');
      if (!draggingKey || draggingKey === b.key) return;
      const rect = card.getBoundingClientRect();
      const dropAbove = e.clientY < rect.top + rect.height / 2;
      const movedKey = draggingKey;
      const fromIdx = BLOCKS.findIndex(x => x.key === movedKey);
      if (fromIdx === -1) return;
      const [moved] = BLOCKS.splice(fromIdx, 1);
      const targetIdx = BLOCKS.findIndex(x => x.key === b.key);
      if (targetIdx === -1) {
        // Target disappeared; restore and bail
        BLOCKS.splice(fromIdx, 0, moved);
        return;
      }
      const insertAt = dropAbove ? targetIdx : targetIdx + 1;
      BLOCKS.splice(insertAt, 0, moved);
      saveBlocks();
      const draggedCard = document.getElementById(`card-${movedKey}`);
      if (draggedCard) {
        if (dropAbove) card.before(draggedCard);
        else card.after(draggedCard);
      }
    });

    updateBlock(b.key);
  }

  function renderAllBlocks() {
    blocksEl.innerHTML = '';
    if (BLOCKS.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No goals yet. Click + Add goal below.';
      blocksEl.appendChild(empty);
      return;
    }
    BLOCKS.forEach(renderBlock);
  }

  function refreshEmptyState() {
    const existing = blocksEl.querySelector('.empty-state');
    if (BLOCKS.length === 0 && !existing) {
      renderAllBlocks();
    } else if (BLOCKS.length > 0 && existing) {
      existing.remove();
    }
  }

  // --- add / remove goals ---
  function addBlock(label, planned) {
    const block = { key: genBlockKey(label), label, planned };
    BLOCKS.push(block);
    saveBlocks();
    const existing = blocksEl.querySelector('.empty-state');
    if (existing) existing.remove();
    renderBlock(block);
    saveState();
    renderYearHeatmap();
  }

  function removeBlock(key) {
    const b = BLOCKS.find(x => x.key === key);
    if (!b) return;
    if (!confirm(`Remove "${b.label}"?`)) return;
    if (activeTimer && activeTimer.key === key) stopTimer();
    BLOCKS = BLOCKS.filter(x => x.key !== key);
    saveBlocks();
    const card = document.getElementById(`card-${key}`);
    if (card) card.remove();
    saveState();
    refreshEmptyState();
    renderYearHeatmap();
    showToast(`Removed "${b.label}"`);
  }

  // Add-goal form
  const addGoalBtn = document.getElementById('addGoalBtn');
  const addForm = document.getElementById('addForm');
  const newLabelEl = document.getElementById('newLabel');
  const newPlannedEl = document.getElementById('newPlanned');

  function openAddForm() {
    addGoalBtn.style.display = 'none';
    addForm.style.display = 'block';
    newLabelEl.value = '';
    newPlannedEl.value = '30';
    setTimeout(() => newLabelEl.focus(), 0);
  }
  function closeAddForm() {
    addGoalBtn.style.display = '';
    addForm.style.display = 'none';
  }

  addGoalBtn.addEventListener('click', openAddForm);
  document.getElementById('cancelAddBtn').addEventListener('click', closeAddForm);
  document.getElementById('confirmAddBtn').addEventListener('click', () => {
    const label = newLabelEl.value.trim();
    if (!label) { newLabelEl.focus(); return; }
    let planned = parseInt(newPlannedEl.value, 10);
    if (isNaN(planned)) planned = 30;
    planned = Math.max(5, Math.min(MAX, Math.round(planned / SNAP) * SNAP));
    addBlock(label, planned);
    closeAddForm();
    showToast(`Added "${label}"`);
  });
  newLabelEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('confirmAddBtn').click(); }
    if (e.key === 'Escape') closeAddForm();
  });
  newPlannedEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('confirmAddBtn').click(); }
    if (e.key === 'Escape') closeAddForm();
  });

  // --- block updates ---
  function updateBlock(key) {
    const b = BLOCKS.find(x => x.key === key);
    if (!b) return;
    const s = document.getElementById(`s-${key}`);
    const v = document.getElementById(`v-${key}`);
    const st = document.getElementById(`st-${key}`);
    if (!s || !v || !st) return;
    const sliderVal = parseInt(s.value, 10);

    let displayVal = sliderVal;
    if (activeTimer && activeTimer.key === key) {
      const elapsedMs = Date.now() - activeTimer.startedAt;
      const elapsedMin = Math.floor(elapsedMs / 60000);
      displayVal = Math.min(MAX, sliderVal + elapsedMin);
    }
    v.textContent = displayVal;

    st.classList.remove('hit', 'over', 'under', 'skipped', 'recording');

    if (activeTimer && activeTimer.key === key) {
      st.textContent = 'Recording';
      st.classList.add('recording');
      return;
    }

    if (displayVal === 0) {
      st.textContent = 'Not started';
      st.classList.add('skipped');
    } else if (displayVal === b.planned) {
      st.textContent = 'On target';
      st.classList.add('hit');
    } else if (displayVal > b.planned) {
      st.textContent = `+${displayVal - b.planned}m over plan`;
      st.classList.add('over');
    } else {
      st.textContent = `${b.planned - displayVal}m short of plan`;
      st.classList.add('under');
    }
  }

  // --- timer ---
  function formatElapsed(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  function tick() {
    if (!activeTimer) return;
    const elapsedMs = Date.now() - activeTimer.startedAt;
    const elapsedEl = document.getElementById(`el-${activeTimer.key}`);
    if (elapsedEl) elapsedEl.textContent = formatElapsed(elapsedMs);
    updateBlock(activeTimer.key);
    updateYearToday();
  }

  function setTimerUI(key, running) {
    const card = document.getElementById(`card-${key}`);
    if (!card) return;
    const btn = card.querySelector('.timer-btn');
    const label = btn.querySelector('.timer-label');
    const slider = document.getElementById(`s-${key}`);
    const chips = card.querySelectorAll('.chip');
    const elapsedEl = document.getElementById(`el-${key}`);

    if (running) {
      btn.classList.add('running');
      label.textContent = 'Stop';
      card.classList.add('running');
      slider.disabled = true;
      chips.forEach(c => c.disabled = true);
    } else {
      btn.classList.remove('running');
      label.textContent = 'Start';
      card.classList.remove('running');
      slider.disabled = false;
      chips.forEach(c => c.disabled = false);
      if (elapsedEl) elapsedEl.textContent = '';
    }
  }

  function startTimer(key) {
    if (activeTimer && activeTimer.key === key) return;
    if (activeTimer) stopTimer();
    activeTimer = { key, startedAt: Date.now() };
    setTimerUI(key, true);
    if (!tickInterval) tickInterval = setInterval(tick, 1000);
    tick();
    saveState();
  }

  function stopTimer() {
    if (!activeTimer) return;
    const key = activeTimer.key;
    const elapsedMs = Date.now() - activeTimer.startedAt;
    const elapsedMin = Math.round(elapsedMs / 60000);
    if (elapsedMin > 0) {
      const s = document.getElementById(`s-${key}`);
      if (s) {
        const newVal = Math.min(MAX, parseInt(s.value, 10) + elapsedMin);
        s.value = Math.round(newVal / SNAP) * SNAP;
      }
    }
    activeTimer = null;
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    setTimerUI(key, false);
    updateBlock(key);
    saveState();
    const b = BLOCKS.find(x => x.key === key);
    const labelStr = b ? b.label : 'goal';
    showToast(elapsedMin > 0 ? `Logged ${elapsedMin}m to ${labelStr}` : 'Stopped (under a minute, not added)');
  }

  // --- persistence ---
  function saveState() {
    const values = {};
    BLOCKS.forEach(b => {
      const s = document.getElementById(`s-${b.key}`);
      if (s) values[b.key] = parseInt(s.value, 10);
    });
    const fields = {};
    NOTES.forEach(n => {
      const t = document.getElementById(`note-input-${n.key}`);
      if (t) fields[n.key] = t.value;
    });
    const state = {
      date: todayKey,
      values,
      active: activeTimer,
      fields,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

    // Mirror today's progress into history so the heatmap reflects it next visit.
    const stats = computeTodayStats();
    const history = getHistory();
    if (stats.total > 0 || stats.planned > 0) {
      history[todayKey] = {
        total: stats.total,
        planned: stats.planned,
        score: stats.score,
        goalsHit: stats.goalsHit,
        goalsTotal: stats.goalsTotal,
      };
    } else {
      delete history[todayKey];
    }
    saveHistory(history);
    updateYearToday();
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);
      if (state.date !== todayKey) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      if (state.values) {
        BLOCKS.forEach(b => {
          if (typeof state.values[b.key] === 'number') {
            const s = document.getElementById(`s-${b.key}`);
            if (s) {
              s.value = state.values[b.key];
              updateBlock(b.key);
            }
          }
        });
      }
      if (state.fields) {
        NOTES.forEach(n => {
          const t = document.getElementById(`note-input-${n.key}`);
          if (t && state.fields[n.key] != null) {
            t.value = state.fields[n.key];
          }
        });
      }
      if (state.active && state.active.key && state.active.startedAt) {
        // Only resume if the block still exists
        if (BLOCKS.some(b => b.key === state.active.key)) {
          activeTimer = state.active;
          setTimerUI(activeTimer.key, true);
          if (!tickInterval) tickInterval = setInterval(tick, 1000);
          tick();
        }
      }
    } catch (e) {}
  }

  // --- init ---
  renderAllBlocks();
  renderAllNotes();
  loadState();
  renderYearHeatmap();

  // --- markdown ---
  function buildMarkdown() {
    const lines = [];
    lines.push(`## ${dateStr}`);
    lines.push('');
    lines.push('**Inputs** (planned → actual)');
    if (BLOCKS.length === 0) {
      lines.push('- (no goals defined)');
    } else {
      const maxLabelLen = Math.max(...BLOCKS.map(b => b.label.length));
      BLOCKS.forEach(b => {
        const s = document.getElementById(`s-${b.key}`);
        const val = s ? parseInt(s.value, 10) : 0;
        const mark = val > 0 ? 'x' : ' ';
        const padLabel = b.label.padEnd(maxLabelLen);
        lines.push(`- [${mark}] ${padLabel}   ${b.planned}m → ${val}m`);
      });
    }
    // Dynamic notes — only include filled ones
    NOTES.forEach(n => {
      const t = document.getElementById(`note-input-${n.key}`);
      const val = t ? t.value.trim() : '';
      if (!val) return;
      lines.push('');
      lines.push(`**${labelToMarkdown(n.label)}:** ${val}`);
    });
    lines.push('');
    lines.push('---');
    lines.push('');
    return lines.join('\n');
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  // --- actions ---
  document.getElementById('previewBtn').addEventListener('click', () => {
    previewEl.textContent = buildMarkdown();
    previewEl.style.display = 'block';
  });

  document.getElementById('copyBtn').addEventListener('click', async () => {
    const md = buildMarkdown();
    try {
      await navigator.clipboard.writeText(md);
      showToast('Markdown copied to clipboard');
    } catch (e) {
      previewEl.textContent = md;
      previewEl.style.display = 'block';
      showToast('Copy failed — preview shown below');
    }
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Clear today\'s slider values and text fields? Your goal list stays.')) return;
    if (activeTimer) stopTimer();
    BLOCKS.forEach(b => {
      const s = document.getElementById(`s-${b.key}`);
      if (s) {
        s.value = 0;
        updateBlock(b.key);
      }
    });
    NOTES.forEach(n => {
      const t = document.getElementById(`note-input-${n.key}`);
      if (t) t.value = '';
    });
    saveState();
    showToast('Day reset');
  });

  // --- add-note form wiring ---
  const addNoteBtn = document.getElementById('addNoteBtn');
  const addNoteForm = document.getElementById('addNoteForm');
  const newNoteLabelEl = document.getElementById('newNoteLabel');
  function openAddNoteForm() {
    addNoteBtn.style.display = 'none';
    addNoteForm.style.display = 'block';
    newNoteLabelEl.value = '';
    setTimeout(() => newNoteLabelEl.focus(), 0);
  }
  function closeAddNoteForm() {
    addNoteBtn.style.display = '';
    addNoteForm.style.display = 'none';
  }
  addNoteBtn.addEventListener('click', openAddNoteForm);
  document.getElementById('cancelAddNoteBtn').addEventListener('click', closeAddNoteForm);
  document.getElementById('confirmAddNoteBtn').addEventListener('click', () => {
    const label = newNoteLabelEl.value.trim();
    if (!label) { newNoteLabelEl.focus(); return; }
    addNote(label);
    closeAddNoteForm();
    showToast(`Added "${label}"`);
  });
  newNoteLabelEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('confirmAddNoteBtn').click(); }
    if (e.key === 'Escape') closeAddNoteForm();
  });

  async function appendToFile() {
    if (activeTimer) stopTimer();
    const md = buildMarkdown();

    if (!('showOpenFilePicker' in window)) {
      try {
        await navigator.clipboard.writeText(md);
        showToast('Browser lacks file access — copied to clipboard instead');
      } catch (e) {
        previewEl.textContent = md;
        previewEl.style.display = 'block';
        showToast('Copy markdown below and paste into daily-log.md');
      }
      return;
    }

    try {
      if (!fileHandle) {
        const picked = await window.showOpenFilePicker({
          types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
          multiple: false,
        });
        fileHandle = picked[0];
      }
      const perm = await fileHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        const req = await fileHandle.requestPermission({ mode: 'readwrite' });
        if (req !== 'granted') throw new Error('Write permission denied');
      }
      const file = await fileHandle.getFile();
      const existing = await file.text();
      const writable = await fileHandle.createWritable();
      const sep = existing.endsWith('\n') ? '' : '\n';
      await writable.write(existing + sep + md);
      await writable.close();
      showToast('Appended to ' + fileHandle.name);
    } catch (e) {
      console.error(e);
      try {
        await navigator.clipboard.writeText(md);
        showToast('Save failed — copied to clipboard');
      } catch (e2) {
        showToast('Save failed: ' + e.message);
      }
    }
  }

  document.getElementById('saveBtn').addEventListener('click', appendToFile);

  // --- help modal ---
  const helpModal = document.getElementById('helpModal');
  function openHelp() { helpModal.classList.add('open'); }
  function closeHelp() { helpModal.classList.remove('open'); }
  document.getElementById('helpBtn').addEventListener('click', openHelp);
  document.getElementById('closeHelpBtn').addEventListener('click', closeHelp);
  document.getElementById('helpBackdrop').addEventListener('click', closeHelp);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpModal.classList.contains('open')) closeHelp();
  });

  window.addEventListener('beforeunload', saveState);
