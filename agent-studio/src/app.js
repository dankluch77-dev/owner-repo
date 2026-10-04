'use strict';

/* ================================================================
   Справочники
   ================================================================ */

// price: доллары за 1 млн токенов [вход, выход]; effort: можно ли настраивать усилие
const MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', price: [4, 20], effort: true, note: 'Сильная модель для сложных рассуждений, планирования и длинных задач.' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', price: [2, 10], effort: true, note: 'Баланс качества, скорости и цены.' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', price: [1, 5], effort: false, note: 'Быстрая и дешёвая: простые и массовые задачи. Усилие не настраивается.' },
  { id: 'claude-fable-5-1', name: 'Claude Fable 5.1', price: [10, 50], effort: true, note: 'Самая мощная модель Anthropic для самых трудных задач. Самая дорогая.' },
];

const EFFORTS = [
  { id: 'low', name: 'Низкое', note: 'Быстро и дёшево, для простых задач.' },
  { id: 'medium', name: 'Среднее', note: 'Обычный уровень.' },
  { id: 'high', name: 'Высокое', note: 'Модель думает дольше: для важных задач.' },
  { id: 'xhigh', name: 'Очень высокое', note: 'Для сложных многошаговых задач.' },
  { id: 'max', name: 'Максимум', note: 'Когда качество важнее цены и времени.' },
];

const SEARCH_PRICE = 0.01;     // $10 за 1000 поисковых запросов

const TOOLS = [
  { id: 'webSearch', name: 'Веб-поиск', note: 'Агент сам ищет в интернете. Около $0,01 за каждый поисковый запрос, не больше 10 запросов за ход.' },
  { id: 'webFetch', name: 'Чтение страниц', note: 'Агент открывает найденные ссылки и читает страницу целиком. Платишь только за токены текста.' },
];

const OLD_STEP_3 = 'Запрос уходит в выбранную модель Claude через API. Сейчас это симуляция, настоящий вызов подключим на следующем этапе.';

const ICONS = {
  agent: '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></svg>',
  source: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  sink: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  up: '<svg viewBox="0 0 16 16"><path d="M4 10l4-4 4 4"/></svg>',
  down: '<svg viewBox="0 0 16 16"><path d="M4 6l4 4 4-4"/></svg>',
  close: '<svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
};

const KINDS = {
  agent: { label: 'ИИ-агент', hasIn: true, hasOut: true, width: 248 },
  source: { label: 'Вход', hasIn: false, hasOut: true, width: 208 },
  sink: { label: 'Результат', hasIn: true, hasOut: false, width: 208 },
};

const GRID = 8;
const PORT_Y = 32;            // центр кружка-порта от верхнего края блока
const STEP_MS = 750;          // сколько длится один шаг в симуляции
const FLOW_MS = 1100;         // сколько данные едут по линии
const STORAGE_KEY = 'agent-studio.schema';

/* ================================================================
   Шаблоны блоков
   ================================================================ */

const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 9);

function claudeSteps() {
  return [
    { title: 'Получает вход', detail: 'Принимает данные, которые пришли по линии от предыдущего блока.' },
    { title: 'Собирает запрос', detail: 'Подставляет вход в шаблон запроса вместо {{вход}} и добавляет системный промпт.' },
    { title: 'Отправляет модели', detail: 'В режиме «Claude API» запрос уходит в выбранную модель Claude. В режиме «Симуляция» этот шаг только показывается.' },
    { title: 'Думает и пишет ответ', detail: 'Модель читает инструкцию и вход, рассуждает и пишет ответ.' },
    { title: 'Отдаёт результат', detail: 'Готовый ответ уходит по линии следующему блоку.' },
  ];
}

function makeNode(kind, x, y) {
  const base = { id: uid(kind), kind, x, y };
  if (kind === 'source') {
    return { ...base, name: 'Вход', description: 'Отсюда стартует цепочка.', data: '' };
  }
  if (kind === 'sink') {
    return { ...base, name: 'Результат', description: 'Сюда приходит итог работы цепочки.' };
  }
  return {
    ...base,
    name: 'Новый агент',
    role: '',
    model: 'claude-opus-5-5',
    effort: 'medium',
    tools: { webSearch: false, webFetch: false },
    input: { text: 'Текст от предыдущего блока', example: '' },
    steps: claudeSteps(),
    systemPrompt: '',
    userPrompt: '{{вход}}',
    output: { text: 'Текстовый ответ', example: '' },
  };
}

function defaultSchema() {
  const task = 'Напиши короткое описание квартиры для объявления: 2 комнаты, 54 м², Братислава, Петржалка, после ремонта.';
  return {
    version: 1,
    nodes: [
      {
        id: 'start', kind: 'source', x: 40, y: 200,
        name: 'Запрос',
        description: 'Отсюда стартует цепочка: задача, которую ты даёшь агентам.',
        data: task,
      },
      {
        id: 'claude', kind: 'agent', x: 360, y: 136,
        name: 'Claude',
        role: 'Универсальный ИИ-ассистент',
        model: 'claude-opus-5-5',
        effort: 'medium',
        input: { text: 'Текст задачи', example: task },
        steps: claudeSteps(),
        systemPrompt: 'Ты внимательный помощник. Отвечай по-русски, коротко и по делу. Если данных не хватает, перечисли, чего именно.',
        userPrompt: 'Задача:\n{{вход}}',
        output: {
          text: 'Готовый текстовый ответ',
          example: 'Светлая двухкомнатная квартира 54 м² в Петржалке после свежего ремонта. Рядом парк, школа и трамвай до центра Братиславы.',
        },
      },
      {
        id: 'result', kind: 'sink', x: 720, y: 200,
        name: 'Результат',
        description: 'Сюда приходит итог работы цепочки.',
      },
    ],
    links: [
      { id: 'l-start-claude', from: 'start', to: 'claude' },
      { id: 'l-claude-result', from: 'claude', to: 'result' },
    ],
    view: null,
    settings: { mode: 'sim' },
  };
}

/* Приводим загруженную схему в порядок: старые или ручные файлы не должны ломать программу. */
function normalize(raw) {
  if (!raw || !Array.isArray(raw.nodes) || !Array.isArray(raw.links)) return null;
  const nodes = raw.nodes
    .filter((n) => n && KINDS[n.kind])
    .map((n) => {
      const tpl = makeNode(n.kind, 0, 0);
      const node = { ...tpl, ...n, id: String(n.id || tpl.id), x: Number(n.x) || 0, y: Number(n.y) || 0 };
      if (n.kind === 'agent') {
        node.input = { ...tpl.input, ...(n.input || {}) };
        node.output = { ...tpl.output, ...(n.output || {}) };
        node.tools = { webSearch: Boolean(n.tools?.webSearch), webFetch: Boolean(n.tools?.webFetch) };
        node.steps = Array.isArray(n.steps) ? n.steps.map((s) => ({ title: String(s?.title ?? ''), detail: String(s?.detail ?? '') })) : tpl.steps;
        node.steps.forEach((s) => { if (s.detail === OLD_STEP_3) s.detail = claudeSteps()[2].detail; });
        if (node.model === 'claude-haiku-4-5-20251001') node.model = 'claude-haiku-4-5';
        if (!EFFORTS.some((e) => e.id === node.effort)) node.effort = 'medium';
      }
      return node;
    });
  const ids = new Set(nodes.map((n) => n.id));
  const links = raw.links
    .filter((l) => l && ids.has(l.from) && ids.has(l.to) && l.from !== l.to)
    .map((l) => ({ id: String(l.id || uid('l')), from: l.from, to: l.to }));
  const v = raw.view;
  const view = v && isFinite(v.x) && isFinite(v.y) && isFinite(v.zoom) ? { x: v.x, y: v.y, zoom: v.zoom } : null;
  const settings = { mode: raw.settings?.mode === 'real' ? 'real' : 'sim' };
  return { version: 1, nodes, links, view, settings };
}

/* ================================================================
   Хранилище: файл через Electron, иначе память браузера
   ================================================================ */

const store = window.studio
  ? window.studio
  : {
      async load() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
      },
      async save(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      },
      async exportFile(data) {
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: 'схема-агентов.json' });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
      },
      importFile() {
        return new Promise((resolve) => {
          const input = $('#import-file');
          input.value = '';
          input.onchange = async () => {
            const file = input.files[0];
            if (!file) return resolve(null);
            try { resolve(JSON.parse(await file.text())); } catch { resolve({ invalid: true }); }
          };
          input.click();
        });
      },
    };

/* ================================================================
   Состояние
   ================================================================ */

let schema = normalize(defaultSchema());
const view = { x: 0, y: 0, zoom: 1 };
let selection = null;         // { type: 'node' | 'link', id }
let gesture = null;           // текущее перетаскивание
let run = null;               // идущая симуляция
let trace = emptyTrace();     // что показывать на блоках после/во время запуска

function emptyTrace() {
  // live: живые данные настоящего запуска по агентам; error: { id, message } блока, на котором всё остановилось
  return { active: null, step: -1, done: new Set(), flowing: new Set(), received: {}, live: {}, error: null };
}

class RunError extends Error {}

const $ = (s, root = document) => root.querySelector(s);
const els = {
  canvas: $('#canvas'),
  world: $('#world'),
  links: $('#links'),
  nodes: $('#nodes'),
  panel: $('#panel'),
  empty: $('#empty'),
  zoomVal: $('#zoom-reset'),
  runBtn: $('#run'),
  modeSim: $('#mode-sim'),
  modeReal: $('#mode-real'),
  keyDialog: $('#key-dialog'),
  saveStatus: $('#save-status'),
};

els.links.innerHTML = '<g id="link-layer"></g><path id="draft" class="link-draft" d="" />';
const linkLayer = $('#link-layer');
const packetLayer = $('#packet-layer');
const draftPath = $('#draft');

const nodeById = (id) => schema.nodes.find((n) => n.id === id);
const linkById = (id) => schema.links.find((l) => l.id === id);
const modelById = (id) => MODELS.find((m) => m.id === id);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function short(s, n) {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/* ================================================================
   Сохранение
   ================================================================ */

let saveTimer = null;
function scheduleSave() {
  els.saveStatus.textContent = 'Сохраняю…';
  els.saveStatus.classList.remove('is-error');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await store.save({ ...schema, view: { ...view } });
      els.saveStatus.textContent = 'Сохранено';
    } catch {
      els.saveStatus.textContent = 'Не удалось сохранить';
      els.saveStatus.classList.add('is-error');
    }
  }, 400);
}

/* ================================================================
   Отрисовка поля
   ================================================================ */

function applyView() {
  els.world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
  els.canvas.style.backgroundPosition = `${view.x}px ${view.y}px`;
  els.canvas.style.backgroundSize = `${24 * view.zoom}px ${24 * view.zoom}px`;
  els.zoomVal.textContent = Math.round(view.zoom * 100) + '%';
}

function portPos(node, side) {
  return side === 'out' ? { x: node.x + KINDS[node.kind].width, y: node.y + PORT_Y } : { x: node.x, y: node.y + PORT_Y };
}

function curve(a, b) {
  const dx = Math.max(60, Math.abs(b.x - a.x) / 2);
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
}

function renderLinks() {
  linkLayer.innerHTML = schema.links.map((l) => {
    const from = nodeById(l.from);
    const to = nodeById(l.to);
    const a = portPos(from, 'out');
    const b = portPos(to, 'in');
    const d = curve(a, b);
    const selected = selection?.type === 'link' && selection.id === l.id;
    const cls = ['link-group', selected && 'is-selected', trace.flowing.has(l.id) && 'is-flowing'].filter(Boolean).join(' ');
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const del = selected
      ? `<g class="link-del" data-link-del="${esc(l.id)}" transform="translate(${mid.x},${mid.y})"><title>Удалить связь</title><circle r="10"/><path d="M-3.5,-3.5 L3.5,3.5 M3.5,-3.5 L-3.5,3.5"/></g>`
      : '';
    return `<g class="${cls}" data-link="${esc(l.id)}"><path class="link" d="${d}"/><path class="link-hit" d="${d}"/>${del}</g>`;
  }).join('');
}

function nodeBody(n) {
  if (n.kind === 'agent') {
    const model = modelById(n.model);
    return `
      ${n.role ? `<div class="node-role">${esc(short(n.role, 70))}</div>` : ''}
      <div class="node-chips">
        <span class="node-model">${esc(model ? model.name : n.model)}</span>
        ${TOOLS.filter((t) => n.tools[t.id]).map((t) => `<span class="node-model node-tool">${esc(t.name.toLowerCase())}</span>`).join('')}
      </div>
      <dl class="node-io">
        <dt>Получает</dt><dd>${esc(short(n.input.text, 40)) || '—'}</dd>
        <dt>Отдаёт</dt><dd>${esc(short(n.output.text, 40)) || '—'}</dd>
        <dt>Шагов</dt><dd>${n.steps.length}</dd>
      </dl>`;
  }
  if (n.kind === 'source') {
    return `<dl class="node-io"><dt>Данные</dt><dd>${esc(short(n.data, 60)) || 'пока пусто'}</dd></dl>`;
  }
  const got = trace.received[n.id];
  return got
    ? `<dl class="node-io"><dt>Пришло</dt><dd>${esc(short(got, 60))}</dd></dl>`
    : `<div class="node-role">${esc(short(n.description, 70))}</div>`;
}

function runStats(r) {
  const parts = [];
  if (r.ms) parts.push((r.ms / 1000).toFixed(1).replace('.', ',') + ' с');
  const cost = costOf(r);
  if (cost != null) parts.push('≈ $' + cost.toFixed(4));
  return parts.join(' · ');
}

function costOf(r) {
  const m = modelById(r.servedModel) || modelById(r.model);
  if (!m || !r.usage) return null;
  return (r.usage.input * m.price[0] + r.usage.output * m.price[1]) / 1e6 + (r.usage.searches || 0) * SEARCH_PRICE;
}

function nodeProgress(n) {
  const isActive = trace.active === n.id;
  const isDone = trace.done.has(n.id);
  const isError = trace.error?.id === n.id;
  const live = trace.live[n.id];
  if (!isActive && !isDone && !isError) return '<div class="node-progress" hidden></div>';
  let label = 'Готово';
  let pct = 100;
  let barCls = 'node-progress-bar';
  if (isError) {
    label = 'Ошибка: ' + trace.error.message;
  } else if (isActive && live) {
    label = live.phase;
    barCls += ' is-indeterminate';
  } else if (isDone && live && n.lastRun) {
    label = 'Готово · ' + runStats(n.lastRun);
  } else if (isActive) {
    if (n.kind === 'agent' && n.steps.length) {
      const i = Math.max(0, trace.step);
      label = `Шаг ${i + 1} из ${n.steps.length} · ${n.steps[i].title || 'без названия'}`;
      pct = ((i + 1) / n.steps.length) * 100;
    } else {
      label = n.kind === 'source' ? 'Отправляет данные' : 'Принимает итог';
      pct = 60;
    }
  }
  return `<div class="node-progress"><div class="node-progress-label" title="${esc(label)}">${esc(label)}</div><div class="${barCls}"><i style="width:${pct}%"></i></div></div>`;
}

function renderNodes() {
  els.nodes.innerHTML = schema.nodes.map((n) => {
    const k = KINDS[n.kind];
    const cls = [
      'node', 'kind-' + n.kind,
      selection?.type === 'node' && selection.id === n.id && 'is-selected',
      trace.active === n.id && 'is-active',
      trace.done.has(n.id) && 'is-done',
      trace.error?.id === n.id && 'is-error',
    ].filter(Boolean).join(' ');
    return `
      <div class="${cls}" data-node="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px">
        ${k.hasIn ? '<span class="port port-in" title="Вход"></span>' : ''}
        ${k.hasOut ? '<span class="port port-out" title="Выход: тяни к другому блоку"></span>' : ''}
        <div class="node-head">
          <span class="node-icon">${ICONS[n.kind]}</span>
          <div class="node-title">
            <div class="node-name">${esc(n.name) || 'Без названия'}</div>
            <div class="node-kind">${k.label}</div>
          </div>
        </div>
        <div class="node-body">${nodeBody(n)}${nodeProgress(n)}</div>
      </div>`;
  }).join('');
  els.empty.hidden = schema.nodes.length > 0;
}

function renderCanvas() {
  renderNodes();
  renderLinks();
  applyView();
}

/* ================================================================
   Панель подробностей
   ================================================================ */

const field = (label, hint, control) =>
  `<label class="field"><span class="field-label">${label}</span>${hint ? `<span class="field-hint">${hint}</span>` : ''}${control}</label>`;

function namesOf(ids) {
  return ids.map((id) => nodeById(id)?.name || 'без названия').join(', ');
}

function renderPanel() {
  const p = els.panel;
  if (selection?.type === 'node') {
    const n = nodeById(selection.id);
    if (n) { p.innerHTML = n.kind === 'agent' ? agentPanel(n) : simplePanel(n); syncStepHighlight(); fillRunSection(); return; }
  }
  if (selection?.type === 'link') {
    const l = linkById(selection.id);
    if (l) { p.innerHTML = linkPanel(l); return; }
  }
  p.innerHTML = overviewPanel();
}

function overviewPanel() {
  const agents = schema.nodes.filter((n) => n.kind === 'agent').length;
  return `
    <div class="panel-empty">
      <h2>Как читать схему</h2>
      <p>Каждый блок делает свою часть работы. Линии показывают, куда уходят данные: от правого кружка одного блока к левому кружку другого.</p>
      <p>Нажми на блок, чтобы увидеть, что он получает, какие шаги выполняет, с какими промптами и моделью работает и что отдаёт дальше.</p>
      <p>«Запуск» прогоняет данные по всей цепочке. В режиме «Симуляция» это только анимация. В режиме «Claude API» каждый агент по-настоящему отправляет запрос модели Claude, и его ответ уходит дальше по линии.</p>
      <div class="legend">
        <div><i class="dot dot-source"></i>Вход: откуда приходят данные</div>
        <div><i class="dot dot-agent"></i>ИИ-агент: обрабатывает данные моделью Claude</div>
        <div><i class="dot dot-sink"></i>Результат: куда приходит итог</div>
      </div>
      <p>На поле: агентов ${agents}, всего блоков ${schema.nodes.length}, связей ${schema.links.length}.</p>
    </div>`;
}

function agentPanel(n) {
  const incoming = schema.links.filter((l) => l.to === n.id).map((l) => l.from);
  const outgoing = schema.links.filter((l) => l.from === n.id).map((l) => l.to);
  const model = modelById(n.model);
  const effortOptions = EFFORTS.map((e) => `<option value="${e.id}" ${e.id === n.effort ? 'selected' : ''}>${esc(e.name)}</option>`).join('');
  const options = MODELS.map((m) => `<option value="${m.id}" ${m.id === n.model ? 'selected' : ''}>${esc(m.name)}</option>`).join('')
    + (model ? '' : `<option value="${esc(n.model)}" selected>${esc(n.model)}</option>`);

  const steps = n.steps.map((s, i) => `
    <li class="step" data-step="${i}">
      <span class="step-num">${i + 1}</span>
      <input id="f-step-title-${i}" class="input" data-step-field="title" value="${esc(s.title)}" placeholder="Название шага">
      <span class="step-tools">
        <button class="icon-btn" data-action="step-up" title="Выше" ${i === 0 ? 'disabled' : ''}>${ICONS.up}</button>
        <button class="icon-btn" data-action="step-down" title="Ниже" ${i === n.steps.length - 1 ? 'disabled' : ''}>${ICONS.down}</button>
        <button class="icon-btn" data-action="step-del" title="Удалить шаг">${ICONS.close}</button>
      </span>
      <textarea id="f-step-detail-${i}" class="textarea" data-step-field="detail" rows="2" placeholder="Что происходит на этом шаге">${esc(s.detail)}</textarea>
    </li>`).join('');

  return `
    <div class="panel-head">
      <div class="panel-kind"><i class="dot dot-agent"></i>ИИ-агент</div>
      <input id="f-name" class="panel-name" data-field="name" value="${esc(n.name)}" placeholder="Название агента">
      <input id="f-role" class="panel-role" data-field="role" value="${esc(n.role)}" placeholder="Роль: за что отвечает агент">
    </div>

    <section class="section">
      <div class="section-head"><h3 class="section-title">Модель</h3></div>
      <select id="f-model" class="select" data-field="model">${options}</select>
      <div class="model-note">${esc(modelNote(model))}</div>
      ${model?.effort === false ? '' : `
        ${field('Усилие', 'Насколько глубоко модель думает перед ответом. Выше усилие: дольше и дороже.',
          `<select id="f-effort" class="select" data-field="effort">${effortOptions}</select>`)}
        <div class="model-note" id="effort-note">${esc(EFFORTS.find((e) => e.id === n.effort)?.note || '')}</div>`}
    </section>

    <section class="section">
      <div class="section-head"><h3 class="section-title">Инструменты</h3><span class="section-note">в режиме «Claude API»</span></div>
      ${TOOLS.map((t) => `
        <label class="check">
          <input type="checkbox" id="f-tool-${t.id}" data-tool="${t.id}" ${n.tools[t.id] ? 'checked' : ''}>
          <span><strong>${esc(t.name)}</strong><span class="field-hint">${esc(t.note)}</span></span>
        </label>`).join('')}
    </section>

    <section class="section">
      <div class="section-head">
        <h3 class="section-title">Получает</h3>
        <span class="section-note">${incoming.length ? 'от: ' + esc(namesOf(incoming)) : 'ни с кем не соединён'}</span>
      </div>
      ${field('Что приходит на вход', '', `<input id="f-input-text" class="input" data-field="input.text" value="${esc(n.input.text)}">`)}
      ${field('Пример данных', '', `<textarea id="f-input-example" class="textarea" data-field="input.example" rows="3">${esc(n.input.example)}</textarea>`)}
    </section>

    <section class="section">
      <div class="section-head">
        <h3 class="section-title">Шаги</h3>
        <span class="section-note">выполняются по порядку</span>
      </div>
      <ol class="steps">${steps}</ol>
      <button class="btn add-step" data-action="step-add">+ Шаг</button>
    </section>

    <section class="section">
      <div class="section-head"><h3 class="section-title">Промпты</h3></div>
      ${field('Системный промпт', 'Постоянная инструкция: кто этот агент и как он работает.',
        `<textarea id="f-system" class="textarea mono" data-field="systemPrompt" rows="5" placeholder="Например: Ты сценарист коротких видео…">${esc(n.systemPrompt)}</textarea>`)}
      ${field('Шаблон запроса', 'Сюда подставляются входные данные: <code>{{вход}}</code> заменится на то, что пришло по линии.',
        `<textarea id="f-user" class="textarea mono" data-field="userPrompt" rows="3">${esc(n.userPrompt)}</textarea>`)}
    </section>

    <section class="section">
      <div class="section-head">
        <h3 class="section-title">Отдаёт</h3>
        <span class="section-note">${outgoing.length ? 'кому: ' + esc(namesOf(outgoing)) : 'ни с кем не соединён'}</span>
      </div>
      ${field('Что выходит', '', `<input id="f-output-text" class="input" data-field="output.text" value="${esc(n.output.text)}">`)}
      ${field('Пример результата', '', `<textarea id="f-output-example" class="textarea" data-field="output.example" rows="3">${esc(n.output.example)}</textarea>`)}
    </section>

    <section class="section" id="run-section">
      <div class="section-head">
        <h3 class="section-title">Последний запуск</h3>
        <span class="section-note">с настоящим ИИ</span>
      </div>
      ${runSectionHtml(n)}
    </section>

    <div class="panel-foot">
      <button class="btn" data-action="duplicate">Копия агента</button>
      <button class="btn btn-danger" data-action="delete-node">Удалить агента</button>
    </div>`;
}

function modelNote(m) {
  if (!m) return '';
  return `${m.note} Цена: $${m.price[0]} за 1 млн токенов на входе, $${m.price[1]} на выходе.`;
}

function runSectionHtml(n) {
  const r = trace.live[n.id] && trace.active === n.id ? trace.live[n.id] : n.lastRun;
  if (!r) {
    return `<div class="field-hint">Агент ещё не запускался с настоящим ИИ. Переключи режим на «Claude API» и нажми «Запуск».</div>`;
  }
  return `
    <div class="run-status" id="lr-status"></div>
    <div class="run-meta" id="lr-meta"></div>
    <details class="run-details">
      <summary>Что ушло в модель</summary>
      <div class="field-label">Системный промпт</div>
      <pre class="readout" id="lr-system"></pre>
      <div class="field-label">Сообщение (шаблон с подставленным входом)</div>
      <pre class="readout" id="lr-user"></pre>
    </details>
    <details class="run-details" id="lr-log-box" hidden>
      <summary id="lr-log-title">Что делал агент</summary>
      <ol class="run-log" id="lr-log"></ol>
    </details>
    <details class="run-details" id="lr-sources-box" hidden>
      <summary id="lr-sources-title">Источники</summary>
      <ul class="run-sources" id="lr-sources"></ul>
    </details>
    <details class="run-details" id="lr-thinking-box">
      <summary>Как модель рассуждала (кратко)</summary>
      <pre class="readout" id="lr-thinking"></pre>
    </details>
    <div class="section-head"><span class="field-label">Ответ</span><button class="btn btn-quiet btn-small" data-action="copy" data-copy="#lr-answer">Копировать</button></div>
    <pre class="readout readout-answer" id="lr-answer"></pre>`;
}

/* Заполняем раздел текстом отдельно от разметки: так при потоковом ответе не сбрасываются раскрытые блоки. */
function fillRunSection() {
  const n = selection?.type === 'node' && nodeById(selection.id);
  if (!n || n.kind !== 'agent' || !$('#lr-status', els.panel)) return;
  const isLive = trace.active === n.id && trace.live[n.id];
  const r = isLive ? trace.live[n.id] : n.lastRun;
  if (!r) return;
  const status = $('#lr-status', els.panel);
  status.className = 'run-status ' + (isLive ? 'is-live' : r.error ? 'is-error' : 'is-ok');
  status.textContent = isLive ? r.phase : r.error ? r.error : 'Готово';

  const meta = [];
  const m = modelById(r.model);
  meta.push((m ? m.name : r.model) + (m?.effort === false ? '' : ', усилие: ' + (EFFORTS.find((e) => e.id === r.effort)?.name || r.effort).toLowerCase()));
  if (r.servedModel && r.servedModel !== r.model) meta.push('ответила модель ' + r.servedModel);
  if (r.note) meta.push(r.note);
  if (r.usage) meta.push(`токенов: ${r.usage.input} на входе, ${r.usage.output} на выходе` + (r.usage.searches ? `, поисков: ${r.usage.searches}` : ''));
  const stats = !isLive && runStats(r);
  if (stats) meta.push(stats);
  if (r.at && !isLive) meta.push(new Date(r.at).toLocaleString('ru-RU'));
  $('#lr-meta', els.panel).textContent = meta.join(' · ');

  const log = r.log || [];
  $('#lr-log-box', els.panel).hidden = !log.length;
  $('#lr-log-title', els.panel).textContent = `Что делал агент (${log.length})`;
  const logEl = $('#lr-log', els.panel);
  logEl.replaceChildren(...log.map((line) => Object.assign(document.createElement('li'), { textContent: line })));
  const sources = r.sources || [];
  $('#lr-sources-box', els.panel).hidden = !sources.length;
  $('#lr-sources-title', els.panel).textContent = `Источники (${sources.length})`;
  $('#lr-sources', els.panel).replaceChildren(...sources.map((src) => {
    const li = document.createElement('li');
    const a = Object.assign(document.createElement('a'), { href: src.url, target: '_blank', rel: 'noreferrer', textContent: src.title || src.url });
    li.append(a);
    return li;
  }));

  $('#lr-system', els.panel).textContent = r.system || '(нет)';
  $('#lr-user', els.panel).textContent = r.user || '';
  $('#lr-thinking', els.panel).textContent = r.thinking || (isLive ? 'Пока пусто…' : 'Модель не показала рассуждения: для простых задач она может отвечать сразу.');
  const answer = $('#lr-answer', els.panel);
  answer.textContent = r.text || (isLive ? '…' : '(пусто)');
  if (isLive) answer.scrollTop = answer.scrollHeight;
}

function simplePanel(n) {
  const isSource = n.kind === 'source';
  const links = isSource
    ? schema.links.filter((l) => l.from === n.id).map((l) => l.to)
    : schema.links.filter((l) => l.to === n.id).map((l) => l.from);
  const got = trace.received[n.id];
  return `
    <div class="panel-head">
      <div class="panel-kind"><i class="dot dot-${n.kind}"></i>${KINDS[n.kind].label}</div>
      <input id="f-name" class="panel-name" data-field="name" value="${esc(n.name)}" placeholder="Название блока">
    </div>
    <section class="section">
      ${field('Описание', '', `<textarea id="f-desc" class="textarea" data-field="description" rows="3">${esc(n.description)}</textarea>`)}
    </section>
    <section class="section">
      <div class="section-head">
        <h3 class="section-title">${isSource ? 'Отправляет' : 'Получает'}</h3>
        <span class="section-note">${links.length ? (isSource ? 'кому: ' : 'от: ') + esc(namesOf(links)) : 'ни с кем не соединён'}</span>
      </div>
      ${isSource
        ? field('Данные для старта', 'Этот текст уйдёт по линии первым при запуске.', `<textarea id="f-data" class="textarea" data-field="data" rows="5">${esc(n.data)}</textarea>`)
        : `<div class="field-hint">${got ? 'При последнем запуске пришло:' : 'Запусти цепочку, и здесь появится итог.'}</div>${got ? `<pre class="readout readout-answer" id="sink-result">${esc(got)}</pre><button class="btn btn-small add-step" data-action="copy" data-copy="#sink-result">Копировать</button>` : ''}`}
    </section>
    <div class="panel-foot">
      <button class="btn btn-danger" data-action="delete-node">Удалить блок</button>
    </div>`;
}

function linkPanel(l) {
  const from = nodeById(l.from);
  const to = nodeById(l.to);
  const carries = from.kind === 'agent' ? from.output.text : from.kind === 'source' ? short(from.data, 120) || 'данные старта' : '';
  const expects = to.kind === 'agent' ? to.input.text : 'итог цепочки';
  return `
    <div class="panel-head">
      <div class="panel-kind">Связь</div>
      <div class="panel-name">${esc(from.name)} → ${esc(to.name)}</div>
    </div>
    <section class="section">
      <div class="field"><span class="field-label">Передаёт</span><div>${esc(carries) || '—'}</div></div>
      <div class="field"><span class="field-label">${esc(to.name)} ждёт на входе</span><div>${esc(expects) || '—'}</div></div>
      <div class="field-hint">Проверь, что одно совпадает с другим: выход первого блока должен подходить ко входу второго.</div>
    </section>
    <div class="panel-foot">
      <button class="btn btn-danger" data-action="delete-link">Удалить связь</button>
    </div>`;
}

function syncStepHighlight() {
  const items = els.panel.querySelectorAll('.step');
  const isRunning = selection?.type === 'node' && trace.active === selection.id;
  const isDone = selection?.type === 'node' && trace.done.has(selection.id);
  items.forEach((li, i) => {
    li.classList.toggle('is-current', isRunning && i === trace.step);
    li.classList.toggle('is-passed', (isRunning && i < trace.step) || isDone);
  });
  if (isRunning) items[trace.step]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], obj)[last] = value;
}

els.panel.addEventListener('input', (e) => {
  const t = e.target;
  const n = selection?.type === 'node' && nodeById(selection.id);
  if (!n) return;
  if (t.dataset.tool) {
    n.tools[t.dataset.tool] = t.checked;
  } else if (t.dataset.field) {
    setPath(n, t.dataset.field, t.value);
    if (t.dataset.field === 'model') { renderNodes(); renderPanel(); scheduleSave(); return; }
    if (t.dataset.field === 'effort') $('#effort-note', els.panel).textContent = EFFORTS.find((x) => x.id === t.value)?.note || '';
  } else if (t.dataset.stepField) {
    const i = Number(t.closest('.step').dataset.step);
    n.steps[i][t.dataset.stepField] = t.value;
  } else {
    return;
  }
  renderNodes();
  scheduleSave();
});

els.panel.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const n = selection?.type === 'node' && nodeById(selection.id);
  const i = Number(btn.closest('.step')?.dataset.step);

  if (action === 'copy') {
    const text = $(btn.dataset.copy, els.panel)?.textContent || '';
    navigator.clipboard.writeText(text).then(() => toast('Скопировано'), () => toast('Не удалось скопировать: выдели текст и нажми Ctrl+C'));
    return;
  }
  if (action === 'delete-node' || action === 'delete-link') return deleteSelection();
  if (action === 'duplicate' && n) return duplicateNode(n);
  if (!n) return;

  if (action === 'step-add') {
    n.steps.push({ title: '', detail: '' });
    renderPanel();
    $(`#f-step-title-${n.steps.length - 1}`)?.focus();
  } else if (action === 'step-del') {
    n.steps.splice(i, 1);
    renderPanel();
  } else if (action === 'step-up' && i > 0) {
    [n.steps[i - 1], n.steps[i]] = [n.steps[i], n.steps[i - 1]];
    renderPanel();
  } else if (action === 'step-down' && i < n.steps.length - 1) {
    [n.steps[i + 1], n.steps[i]] = [n.steps[i], n.steps[i + 1]];
    renderPanel();
  } else {
    return;
  }
  renderNodes();
  scheduleSave();
});

/* ================================================================
   Выделение, добавление, удаление
   ================================================================ */

function select(sel) {
  const same = sel?.type === selection?.type && sel?.id === selection?.id;
  selection = sel;
  renderNodes();
  renderLinks();
  if (!same) renderPanel();
}

function viewCenter() {
  const r = els.canvas.getBoundingClientRect();
  return { x: (r.width / 2 - view.x) / view.zoom, y: (r.height / 2 - view.y) / view.zoom };
}

const snap = (v) => Math.round(v / GRID) * GRID;

function addNode(kind, at) {
  const c = at || viewCenter();
  const shift = at ? 0 : (schema.nodes.length % 5) * 24;
  const node = makeNode(kind, snap(c.x - KINDS[kind].width / 2 + shift), snap(c.y - 60 + shift));
  schema.nodes.push(node);
  select({ type: 'node', id: node.id });
  scheduleSave();
  if (kind === 'agent') setTimeout(() => $('#f-name')?.select(), 0);
}

function addTemplate(t) {
  let baseX = 40;
  let baseY = 40;
  if (schema.nodes.length) {
    const bottom = Math.max(...schema.nodes.map((n) => {
      const el = els.nodes.querySelector(`[data-node="${CSS.escape(n.id)}"]`);
      return n.y + (el ? el.offsetHeight : 160);
    }));
    baseX = Math.min(...schema.nodes.map((n) => n.x));
    baseY = snap(bottom + 100);
  }
  const ids = {};
  const added = t.nodes.map((d) => {
    const raw = JSON.parse(JSON.stringify(d));
    const node = normalize({ nodes: [{ ...raw, id: uid(d.kind), x: baseX + d.x, y: baseY + d.y }], links: [] }).nodes[0];
    delete node.key;
    ids[d.key] = node.id;
    return node;
  });
  schema.nodes.push(...added);
  t.links.forEach(([a, b]) => schema.links.push({ id: uid('l'), from: ids[a], to: ids[b] }));
  const firstAgent = added.find((n) => n.kind === 'agent');
  select(firstAgent ? { type: 'node', id: firstAgent.id } : null);
  renderCanvas();
  fitView();
  scheduleSave();
  toast(`Шаблон «${t.name}» добавлен на поле`);
}

function toggleTemplateMenu(force) {
  const menu = $('#tpl-menu');
  const open = force ?? menu.hidden;
  menu.hidden = !open;
  $('#tpl-btn').setAttribute('aria-expanded', String(open));
}

function duplicateNode(n) {
  const copy = JSON.parse(JSON.stringify(n));
  Object.assign(copy, { id: uid(n.kind), name: n.name + ' (копия)', x: n.x + 32, y: n.y + 32 });
  schema.nodes.push(copy);
  select({ type: 'node', id: copy.id });
  scheduleSave();
}

function deleteSelection() {
  if (!selection || run) return;
  const before = JSON.stringify(schema);
  let message;
  if (selection.type === 'node') {
    const n = nodeById(selection.id);
    schema.nodes = schema.nodes.filter((x) => x.id !== selection.id);
    schema.links = schema.links.filter((l) => l.from !== selection.id && l.to !== selection.id);
    message = `«${n?.name || 'Блок'}» удалён`;
  } else {
    schema.links = schema.links.filter((l) => l.id !== selection.id);
    message = 'Связь удалена';
  }
  select(null);
  scheduleSave();
  toast(message, 'Вернуть', () => {
    schema = normalize(JSON.parse(before));
    select(null);
    scheduleSave();
  });
}

function connect(fromId, toId) {
  if (fromId === toId) return;
  if (schema.links.some((l) => l.from === fromId && l.to === toId)) return;
  schema.links.push({ id: uid('l'), from: fromId, to: toId });
  renderLinks();
  renderPanel();
  scheduleSave();
}

/* ================================================================
   Мышь: перетаскивание блоков, связей и поля
   ================================================================ */

function toWorld(clientX, clientY) {
  const r = els.canvas.getBoundingClientRect();
  return { x: (clientX - r.left - view.x) / view.zoom, y: (clientY - r.top - view.y) / view.zoom };
}

function targetInputNode(clientX, clientY, fromId) {
  const el = document.elementFromPoint(clientX, clientY)?.closest('.node');
  const n = el && nodeById(el.dataset.node);
  return n && n.id !== fromId && KINDS[n.kind].hasIn ? n : null;
}

els.canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 && e.button !== 1) return;
  const t = e.target;
  if (t.closest('.zoom')) return;
  const nodeEl = t.closest('.node');
  const linkEl = t.closest('[data-link]');
  const delEl = t.closest('[data-link-del]');

  if (delEl) {
    selection = { type: 'link', id: delEl.dataset.linkDel };
    deleteSelection();
    return;
  }

  if (t.classList.contains('port-out') && e.button === 0) {
    const from = nodeById(nodeEl.dataset.node);
    gesture = { mode: 'connect', from: from.id, start: portPos(from, 'out') };
    e.preventDefault();
    return;
  }

  if (nodeEl && e.button === 0) {
    const n = nodeById(nodeEl.dataset.node);
    gesture = { mode: 'node', id: n.id, sx: e.clientX, sy: e.clientY, nx: n.x, ny: n.y, moved: false };
    select({ type: 'node', id: n.id });
    return;
  }

  if (linkEl && e.button === 0) {
    select({ type: 'link', id: linkEl.dataset.link });
    return;
  }

  gesture = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
  els.canvas.classList.add('is-panning');
  els.canvas.focus({ preventScroll: true });
});

window.addEventListener('pointermove', (e) => {
  if (!gesture) return;
  if (gesture.mode === 'node') {
    const n = nodeById(gesture.id);
    const dx = (e.clientX - gesture.sx) / view.zoom;
    const dy = (e.clientY - gesture.sy) / view.zoom;
    if (!gesture.moved && Math.hypot(dx, dy) < 3) return;
    gesture.moved = true;
    n.x = snap(gesture.nx + dx);
    n.y = snap(gesture.ny + dy);
    const el = els.nodes.querySelector(`[data-node="${CSS.escape(n.id)}"]`);
    el.style.left = n.x + 'px';
    el.style.top = n.y + 'px';
    renderLinks();
  } else if (gesture.mode === 'pan') {
    const dx = e.clientX - gesture.sx;
    const dy = e.clientY - gesture.sy;
    if (Math.hypot(dx, dy) > 3) gesture.moved = true;
    view.x = gesture.vx + dx;
    view.y = gesture.vy + dy;
    applyView();
  } else if (gesture.mode === 'connect') {
    const target = targetInputNode(e.clientX, e.clientY, gesture.from);
    const end = target ? portPos(target, 'in') : toWorld(e.clientX, e.clientY);
    draftPath.setAttribute('d', curve(gesture.start, end));
    els.nodes.querySelectorAll('.port-in.is-target').forEach((p) => p.classList.remove('is-target'));
    if (target) els.nodes.querySelector(`[data-node="${CSS.escape(target.id)}"] .port-in`)?.classList.add('is-target');
  }
});

window.addEventListener('pointerup', (e) => {
  if (!gesture) return;
  const g = gesture;
  gesture = null;
  if (g.mode === 'node' && g.moved) scheduleSave();
  if (g.mode === 'pan') {
    els.canvas.classList.remove('is-panning');
    if (g.moved) scheduleSave();
    else if (selection) select(null);
  }
  if (g.mode === 'connect') {
    draftPath.setAttribute('d', '');
    const target = targetInputNode(e.clientX, e.clientY, g.from);
    if (target) connect(g.from, target.id);
    else renderNodes();
  }
});

els.canvas.addEventListener('dblclick', (e) => {
  if (e.target.closest('.node, [data-link], .zoom')) return;
  addNode('agent', toWorld(e.clientX, e.clientY));
});

els.canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = els.canvas.getBoundingClientRect();
  zoomAt(view.zoom * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

function zoomAt(z, mx, my) {
  const nz = Math.min(2, Math.max(0.3, z));
  view.x = mx - (mx - view.x) * (nz / view.zoom);
  view.y = my - (my - view.y) * (nz / view.zoom);
  view.zoom = nz;
  applyView();
  scheduleSave();
}

function zoomCenter(factor) {
  const r = els.canvas.getBoundingClientRect();
  zoomAt(view.zoom * factor, r.width / 2, r.height / 2);
}

function fitView() {
  const r = els.canvas.getBoundingClientRect();
  if (!schema.nodes.length) { Object.assign(view, { x: 0, y: 0, zoom: 1 }); applyView(); return; }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of schema.nodes) {
    const el = els.nodes.querySelector(`[data-node="${CSS.escape(n.id)}"]`);
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + KINDS[n.kind].width);
    maxY = Math.max(maxY, n.y + (el ? el.offsetHeight : 120));
  }
  const pad = 80;
  const zoom = Math.min(1, Math.max(0.3, Math.min((r.width - pad * 2) / (maxX - minX), (r.height - pad * 2) / (maxY - minY))));
  view.zoom = zoom;
  view.x = (r.width - (maxX - minX) * zoom) / 2 - minX * zoom;
  view.y = (r.height - (maxY - minY) * zoom) / 2 - minY * zoom;
  applyView();
  scheduleSave();
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !els.keyDialog.hidden) { closeKeyDialog(); return; }
  if (e.key === 'Escape' && !$('#tpl-menu').hidden) { toggleTemplateMenu(false); return; }
  if (e.target.closest('input, textarea, select')) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
    e.preventDefault();
    deleteSelection();
  } else if (e.key === 'Escape') {
    if (gesture?.mode === 'connect') { gesture = null; draftPath.setAttribute('d', ''); }
    select(null);
  }
});

/* ================================================================
   Симуляция запуска
   ================================================================ */

const CANCELLED = Symbol('cancelled');

function sleep(ms, token) {
  return new Promise((resolve, reject) => {
    setTimeout(() => (run?.token === token ? resolve() : reject(CANCELLED)), ms);
  });
}

/* Порядок выполнения: сначала блоки без входящих связей, дальше по линиям. */
function runOrder() {
  const indeg = new Map(schema.nodes.map((n) => [n.id, 0]));
  schema.links.forEach((l) => indeg.set(l.to, indeg.get(l.to) + 1));
  const queue = schema.nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    schema.links.filter((l) => l.from === id).forEach((l) => {
      indeg.set(l.to, indeg.get(l.to) - 1);
      if (indeg.get(l.to) === 0) queue.push(l.to);
    });
  }
  schema.nodes.forEach((n) => { if (!order.includes(n.id)) order.push(n.id); }); // блоки в петлях
  return order;
}

function payloadOf(n) {
  if (n.kind === 'source') return n.data || n.description || 'данные';
  if (n.kind === 'agent') return n.output.example || n.output.text || 'ответ';
  return '';
}

function packetLabel(n) {
  if (n.kind === 'agent') return short(n.output.text || 'ответ', 26);
  return short(n.data, 26) || 'данные';
}

function animatePacket(link, label, token) {
  return new Promise((resolve, reject) => {
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.innerHTML = `<circle class="packet-glow" r="11"/><circle class="packet" r="5"/><text class="packet-label" y="-14" text-anchor="middle"></text>`;
    g.querySelector('text').textContent = label;
    packetLayer.appendChild(g);
    const t0 = performance.now();
    const frame = (now) => {
      if (run?.token !== token) { g.remove(); return reject(CANCELLED); }
      const path = linkLayer.querySelector(`[data-link="${CSS.escape(link.id)}"] .link`);
      const k = Math.min(1, (now - t0) / FLOW_MS);
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      if (path) {
        const p = path.getPointAtLength(path.getTotalLength() * ease);
        g.setAttribute('transform', `translate(${p.x},${p.y})`);
      }
      if (k < 1) requestAnimationFrame(frame);
      else { g.remove(); resolve(); }
    };
    requestAnimationFrame(frame);
  });
}

function refreshRun() {
  renderNodes();
  renderLinks();
  syncStepHighlight();
}

/* Настоящий вызов Claude для одного агента. Возвращает текст ответа. */
async function runRealAgent(n, inputs, token) {
  const input = inputs.length ? inputs.join('\n\n') : (n.input.example || '');
  if (!input.trim()) {
    throw new RunError('нет входных данных. Соедини агента с блоком входа или заполни «Пример данных».');
  }
  const tpl = n.userPrompt.trim() || '{{вход}}';
  const user = tpl.includes('{{вход}}') ? tpl.split('{{вход}}').join(input) : tpl + '\n\n' + input;
  const runId = uid('run');
  const live = {
    phase: 'Собирает запрос', model: n.model, effort: n.effort,
    system: n.systemPrompt.trim(), user, thinking: '', text: '', note: '', log: [], sources: [],
  };
  trace.live[n.id] = live;
  run.agentRunId = runId;
  refreshRun();
  if (selection?.type === 'node' && selection.id === n.id) {
    renderPanel();
    $('#run-section', els.panel)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  const off = store.onAgentEvent((ev) => {
    if (ev.runId !== runId) return;
    if (ev.kind === 'sent') live.phase = 'Ждёт ответ от ' + (modelById(n.model)?.name || n.model);
    else if (ev.kind === 'thinking') { live.thinking += ev.text; live.phase = 'Рассуждает'; }
    else if (ev.kind === 'text') { live.text += ev.text; live.phase = 'Пишет ответ · ' + live.text.length + ' симв.'; }
    else if (ev.kind === 'fallback') live.note = `${ev.from} отказалась отвечать, запрос передан ${ev.to}`;
    else if (ev.kind === 'tool') {
      const line = ev.name === 'web_search' ? `Ищет: «${ev.query || '…'}»` : ev.name === 'web_fetch' ? `Читает: ${ev.url || '…'}` : `Инструмент: ${ev.name}`;
      live.log.push(line);
      live.phase = line;
    } else if (ev.kind === 'sources') {
      for (const it of ev.items) if (!live.sources.some((x) => x.url === it.url)) live.sources.push(it);
    } else if (ev.kind === 'continue') {
      live.log.push('Поиск длинный: сервер поставил ход на паузу, продолжаем');
    }
    scheduleLiveRender();
  });

  let res;
  try {
    res = await store.runAgent({ runId, model: n.model, effort: n.effort, tools: n.tools, system: live.system, user });
  } finally {
    off();
    if (run) run.agentRunId = null;
  }

  n.lastRun = {
    at: new Date().toISOString(),
    model: n.model, servedModel: res.model, effort: n.effort,
    system: live.system, user,
    thinking: res.thinking ?? live.thinking, text: res.text ?? live.text,
    usage: res.usage, ms: res.ms, stopReason: res.stopReason,
    note: live.note, error: res.ok ? null : res.error,
    log: live.log, sources: res.sources?.length ? res.sources : live.sources,
  };
  scheduleSave();
  if (run?.token !== token) throw CANCELLED;
  if (!res.ok) throw new RunError(res.error);
  if (res.stopReason === 'max_tokens') toast(`«${n.name}»: ответ обрезан, модель упёрлась в лимит длины`);
  return res.text;
}

let liveFrame = 0;
function scheduleLiveRender() {
  if (liveFrame) return;
  liveFrame = requestAnimationFrame(() => {
    liveFrame = 0;
    renderNodes();
    fillRunSection();
  });
}

async function startRun() {
  if (!schema.nodes.length) return toast('Сначала добавь хотя бы один блок');
  const real = schema.settings.mode === 'real';
  if (real) {
    if (!store.runAgent) return toast('Настоящий запуск работает только в программе, не в браузере');
    const st = await store.keyStatus();
    if (!st.hasKey) { openKeyDialog('Чтобы агенты работали с настоящим ИИ, нужен ключ API.'); return; }
  }
  const token = {};
  run = { token, agentRunId: null };
  trace = emptyTrace();
  els.runBtn.classList.add('is-running');
  els.runBtn.querySelector('span').textContent = 'Стоп';
  const inbox = {};
  let current = null;

  try {
    for (const id of runOrder()) {
      const n = nodeById(id);
      if (!n) continue;
      current = id;
      trace.active = id;
      trace.step = 0;
      refreshRun();

      let payload = payloadOf(n);
      if (real && n.kind === 'agent') {
        trace.step = -1;
        payload = await runRealAgent(n, inbox[id] || [], token);
      } else if (n.kind === 'agent' && n.steps.length) {
        for (let i = 0; i < n.steps.length; i++) {
          trace.step = i;
          refreshRun();
          await sleep(STEP_MS, token);
        }
      } else {
        await sleep(real ? 300 : STEP_MS, token);
      }

      if (n.kind === 'sink') trace.received[id] = (inbox[id] || []).join('\n\n') || 'ничего не пришло: блок ни с кем не соединён';
      trace.done.add(id);
      trace.active = null;
      trace.step = -1;

      const out = schema.links.filter((l) => l.from === id);
      out.forEach((l) => trace.flowing.add(l.id));
      refreshRun();
      out.forEach((l) => (inbox[l.to] = inbox[l.to] || []).push(payload));
      await Promise.all(out.map((l) => animatePacket(l, packetLabel(n), token)));
      out.forEach((l) => trace.flowing.delete(l.id));
      refreshRun();
    }
    toast('Цепочка отработала');
  } catch (err) {
    if (err instanceof RunError) {
      const name = nodeById(current)?.name || 'Блок';
      trace.error = { id: current, message: err.message };
      toast(`«${name}»: ${err.message}`);
    } else if (err === CANCELLED) {
      trace = emptyTrace();
    } else {
      throw err;
    }
  } finally {
    if (run?.token === token) run = null;
    packetLayer.innerHTML = '';
    els.runBtn.classList.remove('is-running');
    els.runBtn.querySelector('span').textContent = 'Запуск';
    trace.active = null;
    trace.flowing.clear();
    refreshRun();
    if (selection?.type === 'node') renderPanel();
  }
}

function stopRun() {
  if (run?.agentRunId) store.abortAgent(run.agentRunId);
  run = null;
}

/* ================================================================
   Режим запуска и ключ API
   ================================================================ */

function renderMode() {
  const real = schema.settings.mode === 'real';
  els.modeSim.classList.toggle('is-on', !real);
  els.modeReal.classList.toggle('is-on', real);
  els.modeSim.setAttribute('aria-checked', String(!real));
  els.modeReal.setAttribute('aria-checked', String(real));
  els.runBtn.title = real ? 'Запустить цепочку с настоящим Claude (платно)' : 'Показать, как данные проходят по цепочке (бесплатно)';
}

function setMode(mode) {
  if (run) return toast('Сначала останови текущий запуск');
  schema.settings.mode = mode;
  renderMode();
  scheduleSave();
  if (mode === 'real' && store.keyStatus) {
    store.keyStatus().then((st) => { if (!st.hasKey) openKeyDialog('Чтобы агенты работали с настоящим ИИ, нужен ключ API.'); });
  }
}

async function openKeyDialog(reason) {
  if (!store.keyStatus) return toast('Ключ API можно добавить только в программе, не в браузере');
  const d = els.keyDialog;
  $('#key-reason', d).textContent = reason || '';
  $('#key-reason', d).hidden = !reason;
  $('#key-error', d).hidden = true;
  $('#key-input', d).value = '';
  d.hidden = false;
  await refreshKeyStatus();
  $('#key-input', d).focus();
}

async function refreshKeyStatus() {
  const st = await store.keyStatus();
  const el = $('#key-status', els.keyDialog);
  el.textContent = st.hasKey
    ? `Ключ сохранён: ${st.hint}` + (st.source === 'env' ? ' (из переменной ANTHROPIC_API_KEY)' : '')
    : 'Ключа пока нет.';
  el.classList.toggle('is-ok', st.hasKey);
  $('#key-clear', els.keyDialog).hidden = st.source !== 'file';
}

function closeKeyDialog() {
  els.keyDialog.hidden = true;
}

async function saveKey() {
  const d = els.keyDialog;
  const btn = $('#key-save', d);
  const err = $('#key-error', d);
  btn.disabled = true;
  btn.textContent = 'Проверяю…';
  err.hidden = true;
  try {
    const res = await store.setKey($('#key-input', d).value);
    if (!res.ok) {
      err.textContent = res.error;
      err.hidden = false;
      return;
    }
    $('#key-input', d).value = '';
    await refreshKeyStatus();
    closeKeyDialog();
    toast('Ключ проверен и сохранён');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Сохранить и проверить';
  }
}

/* ================================================================
   Уведомления
   ================================================================ */

let toastTimer = null;
function toast(text, actionLabel, onAction) {
  $('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = text;
  if (actionLabel) {
    const b = document.createElement('button');
    b.className = 'btn btn-quiet';
    b.style.marginLeft = '10px';
    b.style.height = '24px';
    b.style.color = 'var(--signal)';
    b.textContent = actionLabel;
    b.onclick = () => { el.remove(); onAction(); };
    el.appendChild(b);
  }
  document.body.appendChild(el);
  toastTimer = setTimeout(() => el.remove(), actionLabel ? 6000 : 2500);
}

/* ================================================================
   Кнопки верхней панели
   ================================================================ */

$('#add-agent').onclick = () => addNode('agent');
$('#add-source').onclick = () => addNode('source');
$('#add-sink').onclick = () => addNode('sink');
$('#tpl-menu').innerHTML = TEMPLATES.map((t) => `
  <button class="tpl-item" role="menuitem" data-tpl="${t.id}">
    <strong>${esc(t.name)}</strong><span>${esc(t.note)}</span>
  </button>`).join('');
$('#tpl-btn').onclick = (e) => { e.stopPropagation(); toggleTemplateMenu(); };
$('#tpl-menu').onclick = (e) => {
  const item = e.target.closest('[data-tpl]');
  if (!item) return;
  toggleTemplateMenu(false);
  addTemplate(TEMPLATES.find((t) => t.id === item.dataset.tpl));
};
document.addEventListener('pointerdown', (e) => {
  if (!$('#tpl-menu').hidden && !e.target.closest('#tpl-menu, #tpl-btn')) toggleTemplateMenu(false);
});
els.runBtn.onclick = () => (run ? stopRun() : startRun());
els.modeSim.onclick = () => setMode('sim');
els.modeReal.onclick = () => setMode('real');
$('#key-btn').onclick = () => openKeyDialog();
$('#key-save').onclick = saveKey;
$('#key-close').onclick = closeKeyDialog;
$('#key-clear').onclick = async () => { await store.clearKey(); await refreshKeyStatus(); toast('Ключ удалён'); };
$('#key-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveKey(); });
els.keyDialog.addEventListener('pointerdown', (e) => { if (e.target === els.keyDialog) closeKeyDialog(); });
$('#zoom-in').onclick = () => zoomCenter(1.2);
$('#zoom-out').onclick = () => zoomCenter(1 / 1.2);
els.zoomVal.onclick = fitView;

$('#export').onclick = async () => {
  try {
    if (await store.exportFile({ ...schema, view: { ...view } })) toast('Схема сохранена в файл');
  } catch {
    toast('Не получилось сохранить файл');
  }
};

$('#import').onclick = async () => {
  let raw;
  try { raw = await store.importFile(); } catch { raw = { invalid: true }; }
  if (!raw) return;
  const next = normalize(raw);
  if (!next) return toast('Это не файл схемы агентов');
  if (run) stopRun();
  schema = next;
  trace = emptyTrace();
  renderMode();
  select(null);
  renderCanvas();
  if (next.view) Object.assign(view, next.view), applyView();
  else fitView();
  scheduleSave();
  toast('Схема загружена');
};

/* ================================================================
   Старт
   ================================================================ */

(async function init() {
  const saved = normalize(await store.load());
  if (saved) schema = saved;
  renderCanvas();
  renderPanel();
  renderMode();
  if (saved?.view) {
    Object.assign(view, saved.view);
    applyView();
  } else {
    fitView();
  }
  els.saveStatus.textContent = saved ? 'Сохранено' : 'Новая схема';
})();
