// Вызовы Claude из главного процесса: ключ API и потоковые ответы агентов.
// Ключ живёт только здесь, окно программы его не видит.
const { app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const SDK = require('@anthropic-ai/sdk');

const Anthropic = SDK.default || SDK.Anthropic || SDK;

const keyFile = () => path.join(app.getPath('userData'), 'api-key.bin');
const PLAIN_PREFIX = 'plain:';

async function readStoredKey() {
  try {
    const buf = await fs.readFile(keyFile());
    const asText = buf.toString('utf8');
    if (asText.startsWith(PLAIN_PREFIX)) return asText.slice(PLAIN_PREFIX.length);
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

async function getKey() {
  const stored = await readStoredKey();
  if (stored) return { key: stored, source: 'file' };
  if (process.env.ANTHROPIC_API_KEY) return { key: process.env.ANTHROPIC_API_KEY, source: 'env' };
  return { key: null, source: null };
}

const hint = (key) => (key ? key.slice(0, 7) + '…' + key.slice(-4) : '');

async function keyStatus() {
  const { key, source } = await getKey();
  return { hasKey: Boolean(key), hint: hint(key), source };
}

function explainError(err, model) {
  if (err instanceof Anthropic.APIUserAbortError) return 'Запуск остановлен.';
  if (err instanceof Anthropic.AuthenticationError) return 'Ключ API не подошёл. Проверь его в настройках ключа.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'У этого ключа нет доступа к модели ' + model + '.';
  if (err instanceof Anthropic.NotFoundError) return 'Модель не найдена: ' + model + '.';
  if (err instanceof Anthropic.RateLimitError) return 'Превышен лимит запросов. Подожди минуту и запусти снова.';
  if (err instanceof Anthropic.BadRequestError) {
    const extra = /web.?(search|fetch)/i.test(err.message) ? ' Возможно, веб-поиск не включён для организации в консоли Anthropic.' : '';
    return 'Запрос отклонён: ' + err.message + extra;
  }
  if (err instanceof Anthropic.InternalServerError) return 'Сервер Anthropic перегружен или недоступен. Попробуй ещё раз чуть позже.';
  if (err instanceof Anthropic.APIConnectionError) return 'Нет связи с сервером Anthropic. Проверь интернет.';
  if (err instanceof Anthropic.APIError) return 'Ошибка API (' + err.status + '): ' + err.message;
  return 'Неизвестная ошибка: ' + (err && err.message ? err.message : String(err));
}

async function setKey(key) {
  key = String(key || '').trim();
  if (!key) return { ok: false, error: 'Вставь ключ API.' };
  try {
    // Самый дешёвый способ проверить ключ: список моделей, без генерации.
    await new Anthropic({ apiKey: key }).models.list({ limit: 1 });
  } catch (err) {
    return { ok: false, error: explainError(err, '') };
  }
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(key)
    : Buffer.from(PLAIN_PREFIX + key, 'utf8');
  await fs.writeFile(keyFile(), data);
  return { ok: true, hint: hint(key) };
}

async function clearKey() {
  await fs.rm(keyFile(), { force: true });
  return keyStatus();
}

const active = new Map();

// Новые версии веб-инструментов (с фильтрацией результатов) есть у Opus 5.5 и Sonnet 5.5,
// остальным моделям даём базовые версии.
function webTools(model, tools) {
  const modern = model === 'claude-opus-5-5' || model === 'claude-sonnet-5-5';
  const list = [];
  if (tools && tools.webSearch) list.push({ type: modern ? 'web_search_20260209' : 'web_search_20250305', name: 'web_search', max_uses: 10 });
  if (tools && tools.webFetch) list.push({ type: modern ? 'web_fetch_20260209' : 'web_fetch_20250910', name: 'web_fetch', max_uses: 10 });
  return list;
}

const MAX_CONTINUATIONS = 5;

async function runAgent(sender, req) {
  const { key } = await getKey();
  if (!key) return { ok: false, error: 'Нет ключа API. Добавь его кнопкой «Ключ API».' };

  const send = (kind, data) => {
    if (!sender.isDestroyed()) sender.send('agent:event', { runId: req.runId, kind, ...data });
  };

  const client = new Anthropic({ apiKey: key });
  const isHaiku = req.model.startsWith('claude-haiku');
  const tools = webTools(req.model, req.tools);
  const messages = [{ role: 'user', content: req.user }];
  const base = { model: req.model, max_tokens: 64000 };
  if (req.system) base.system = req.system;
  if (tools.length) base.tools = tools;

  const openStream = () => {
    if (isHaiku) {
      // Haiku 4.5 не поддерживает adaptive thinking и effort: обычный запрос.
      return client.messages.stream({ ...base, messages });
    }
    return client.beta.messages.stream({
      ...base,
      messages,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: req.effort || 'medium' },
      // Если модель откажется по правилам безопасности, сервер сам передаст запрос подходящей модели.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  };

  const started = Date.now();
  const usage = { input: 0, output: 0, searches: 0 };
  const texts = [];
  const thoughts = [];
  const sources = [];
  let msg;

  try {
    send('sent', {});
    for (let round = 0; ; round++) {
      const stream = openStream();
      active.set(req.runId, stream);
      const toolInputs = {};
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          const block = event.content_block;
          if (block.type === 'fallback') send('fallback', { from: block.from?.model, to: block.to?.model });
          else if (block.type === 'server_tool_use') toolInputs[event.index] = { name: block.name, json: '' };
          else if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
            const found = block.content.filter((r) => r.url).map((r) => ({ title: r.title || r.url, url: r.url }));
            sources.push(...found);
            send('sources', { items: found });
          } else if (block.type === 'thinking' || block.type === 'text') send('block', { type: block.type });
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'thinking_delta') send('thinking', { text: event.delta.thinking });
          else if (event.delta.type === 'text_delta') send('text', { text: event.delta.text });
          else if (event.delta.type === 'input_json_delta' && toolInputs[event.index]) toolInputs[event.index].json += event.delta.partial_json;
        } else if (event.type === 'content_block_stop' && toolInputs[event.index]) {
          const t = toolInputs[event.index];
          let input = {};
          try { input = JSON.parse(t.json || '{}'); } catch { /* неполный ввод инструмента: покажем без деталей */ }
          send('tool', { name: t.name, query: input.query, url: input.url });
        }
      }
      msg = await stream.finalMessage();
      usage.input += msg.usage.input_tokens;
      usage.output += msg.usage.output_tokens;
      usage.searches += msg.usage.server_tool_use?.web_search_requests || 0;
      texts.push(msg.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
      thoughts.push(...msg.content.filter((b) => b.type === 'thinking' && b.thinking).map((b) => b.thinking));

      // Длинный поиск сервер ставит на паузу: отправляем ход обратно, и он продолжает с того же места.
      if (msg.stop_reason !== 'pause_turn' || round >= MAX_CONTINUATIONS) break;
      messages.push({ role: 'assistant', content: msg.content });
      send('continue', {});
    }

    const result = {
      ok: msg.stop_reason !== 'refusal',
      text: texts.join(''),
      thinking: thoughts.join('\n\n'),
      sources: sources.filter((s, i) => sources.findIndex((x) => x.url === s.url) === i),
      model: msg.model,
      stopReason: msg.stop_reason,
      usage,
      ms: Date.now() - started,
    };
    if (msg.stop_reason === 'refusal') {
      const category = msg.stop_details && msg.stop_details.category;
      result.error = 'Модель отказалась выполнять запрос' + (category ? ' (категория: ' + category + ')' : '') + '.';
    }
    return result;
  } catch (err) {
    return { ok: false, aborted: err instanceof Anthropic.APIUserAbortError, error: explainError(err, req.model), ms: Date.now() - started };
  } finally {
    active.delete(req.runId);
  }
}

function abortAgent(runId) {
  active.get(runId)?.abort();
}

module.exports = { keyStatus, setKey, clearKey, runAgent, abortAgent };
