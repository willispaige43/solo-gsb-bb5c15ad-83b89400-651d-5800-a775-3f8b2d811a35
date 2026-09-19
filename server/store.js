import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed } from './seed.js';
import { canonicalSeq } from '../shared/key.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
const DATA_FILE = join(DATA_DIR, 'state.json');

let state = null;

export function load() {
  try {
    if (existsSync(DATA_FILE)) {
      const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
      if (raw && Array.isArray(raw.contexts) && Array.isArray(raw.commands)) {
        state = raw;
        return state;
      }
    }
  } catch (err) {
    console.warn('[store] 状态文件读取失败，使用初始数据：', err.message);
  }
  state = seed();
  persist();
  return state;
}

export function getState() {
  if (!state) load();
  return state;
}

export function persist() {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function reset() {
  state = seed();
  persist();
  return state;
}

// --- 工具 ---
export function findContext(id) {
  return getState().contexts.find((c) => c.id === id) || null;
}

export function contextPathLabel(id) {
  const byId = new Map(getState().contexts.map((c) => [c.id, c]));
  const names = [];
  let cur = byId.get(id);
  while (cur) {
    names.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  return names.join(' / ');
}

export function depthOf(id) {
  const byId = new Map(getState().contexts.map((c) => [c.id, c]));
  let d = 0;
  let cur = byId.get(id);
  while (cur && cur.parentId) {
    d += 1;
    cur = byId.get(cur.parentId);
  }
  return d;
}

let seqCounter = 0;
function nextId(prefix) {
  seqCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${seqCounter}`;
}

// --- 上下文 ---
export function addContext({ name, parentId }) {
  const s = getState();
  const trimmed = String(name || '').trim();
  if (!trimmed) throw badRequest('上下文名称不能为空');
  const parent = parentId || s.rootId;
  if (parent && !findContext(parent)) throw badRequest('父上下文不存在');
  const ctx = { id: nextId('ctx'), name: trimmed, parentId: parent || null };
  s.contexts.push(ctx);
  persist();
  return ctx;
}

export function renameContext(id, name) {
  const ctx = findContext(id);
  if (!ctx) throw notFound('上下文不存在');
  const trimmed = String(name || '').trim();
  if (!trimmed) throw badRequest('上下文名称不能为空');
  ctx.name = trimmed;
  persist();
  return ctx;
}

export function deleteContext(id) {
  const s = getState();
  if (id === s.rootId) throw badRequest('根上下文不可删除');
  if (!findContext(id)) throw notFound('上下文不存在');

  // 收集整棵子树
  const toDelete = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of s.contexts) {
      if (c.parentId && toDelete.has(c.parentId) && !toDelete.has(c.id)) {
        toDelete.add(c.id);
        changed = true;
      }
    }
  }

  const deletedContexts = s.contexts.filter((c) => toDelete.has(c.id));
  s.contexts = s.contexts.filter((c) => !toDelete.has(c.id));
  const deletedCommands = s.commands.filter((cmd) => toDelete.has(cmd.contextId));
  s.commands = s.commands.filter((cmd) => !toDelete.has(cmd.contextId));
  persist();
  return { deletedContexts: deletedContexts.length, deletedCommands: deletedCommands.length };
}

// --- 命令 ---
export function addCommand({ name, contextId, seq }) {
  const s = getState();
  const trimmed = String(name || '').trim();
  if (!trimmed) throw badRequest('命令名称不能为空');
  const ctxId = contextId || s.rootId;
  if (!findContext(ctxId)) throw badRequest('所属上下文不存在');
  const normalized = canonicalSeq(seq);
  if (!normalized) throw badRequest('按键序列非法：需由 1～3 次按键组成（如 ctrl+k、g d）');

  const cmd = { id: nextId('cmd'), name: trimmed, contextId: ctxId, seq: normalized };
  s.commands.push(cmd);
  persist();
  return cmd;
}

export function updateCommand(id, patch) {
  const s = getState();
  const cmd = s.commands.find((c) => c.id === id);
  if (!cmd) throw notFound('命令不存在');
  if (patch.name !== undefined) {
    const trimmed = String(patch.name || '').trim();
    if (!trimmed) throw badRequest('命令名称不能为空');
    cmd.name = trimmed;
  }
  if (patch.contextId !== undefined) {
    if (!findContext(patch.contextId)) throw badRequest('所属上下文不存在');
    cmd.contextId = patch.contextId;
  }
  if (patch.seq !== undefined) {
    const normalized = canonicalSeq(patch.seq);
    if (!normalized) throw badRequest('按键序列非法：需由 1～3 次按键组成');
    cmd.seq = normalized;
  }
  persist();
  return cmd;
}

export function deleteCommand(id) {
  const s = getState();
  const before = s.commands.length;
  s.commands = s.commands.filter((c) => c.id !== id);
  if (s.commands.length === before) throw notFound('命令不存在');
  persist();
  return { id };
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const badRequest = (msg) => new HttpError(400, msg);
export const notFound = (msg) => new HttpError(404, msg);
export { HttpError };
