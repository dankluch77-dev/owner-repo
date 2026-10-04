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
  if (err instanceof Anthropic.BadRequestError) return 'Запрос отклонён: ' + err.message;
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

async function runAgent(sender, req) {
  const { key } = await getKey();
  if (!key) return { ok: false, error: 'Нет ключа API. Добавь его кнопкой «Ключ API».' };

  const send = (kind, data) => {
    if (!sender.isDestroyed()) sender.send('agent:event', { runId: req.runId, kind, ...data });
  };

  const client = new Anthropic({ apiKey: key });
  const isHaiku = req.model.startsWith('claude-haiku');
  const params = {
    model: req.model,
    max_tokens: 64000,
    messages: [{ role: 'user', content: req.user }],
  };
  if (req.system) params.system = req.system;

  let stream;
  if (isHaiku) {
    // Haiku 4.5 не поддерживает adaptive thinking и effort: обычный запрос.
    stream = client.messages.stream(params);
  } else {
    stream = client.beta.messages.stream({
      ...params,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: req.effort || 'medium' },
      // Если модель откажется по правилам безопасности, сервер сам передаст запрос подходящей модели.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  }
  active.set(req.runId, stream);
  const started = Date.now();

  try {
    send('sent', {});
    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = event.content_block;
        if (block.type === 'fallback') send('fallback', { from: block.from?.model, to: block.to?.model });
        else if (block.type === 'thinking' || block.type === 'text') send('block', { type: block.type });
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'thinking_delta') send('thinking', { text: event.delta.thinking });
        else if (event.delta.type === 'text_delta') send('text', { text: event.delta.text });
      }
    }
    const msg = await stream.finalMessage();
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const thinking = msg.content.filter((b) => b.type === 'thinking').map((b) => b.thinking).join('\n\n');
    const result = {
      ok: msg.stop_reason !== 'refusal',
      text,
      thinking,
      model: msg.model,
      stopReason: msg.stop_reason,
      usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens },
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
