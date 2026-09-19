import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import {
  getState,
  reset,
  addContext,
  renameContext,
  deleteContext,
  addCommand,
  updateCommand,
  deleteCommand,
  findContext,
  HttpError,
} from './store.js';
import { resolveBindings } from './resolve.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const DIST_DIR = join(__dirname, '..', 'dist');

const app = express();
app.use(express.json());

// 极简 CORS（方便 vite dev server 直连，正常情况下走代理也用得上）
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const asyncWrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- 状态 ---
app.get('/api/state', (req, res) => {
  res.json(getState());
});

app.post('/api/reset', (req, res) => {
  res.json(reset());
});

// --- 解析：选中上下文后的生效绑定 / 覆盖 / 冲突 ---
app.get(
  '/api/resolve/:contextId',
  asyncWrap((req, res) => {
    const { contextId } = req.params;
    if (!findContext(contextId)) throw new HttpError(404, '上下文不存在');
    res.json(resolveBindings(getState(), contextId));
  })
);

// --- 上下文 CRUD ---
app.post(
  '/api/contexts',
  asyncWrap((req, res) => {
    const ctx = addContext(req.body || {});
    res.status(201).json(ctx);
  })
);

app.patch(
  '/api/contexts/:id',
  asyncWrap((req, res) => {
    res.json(renameContext(req.params.id, (req.body || {}).name));
  })
);

app.delete(
  '/api/contexts/:id',
  asyncWrap((req, res) => {
    res.json(deleteContext(req.params.id));
  })
);

// --- 命令 CRUD ---
app.post(
  '/api/commands',
  asyncWrap((req, res) => {
    const cmd = addCommand(req.body || {});
    res.status(201).json(cmd);
  })
);

app.put(
  '/api/commands/:id',
  asyncWrap((req, res) => {
    res.json(updateCommand(req.params.id, req.body || {}));
  })
);

app.delete(
  '/api/commands/:id',
  asyncWrap((req, res) => {
    res.json(deleteCommand(req.params.id));
  })
);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// --- 统一错误 ---
app.use('/api', (err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

// --- 生产环境托管前端构建产物（SPA 回退）---
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    res.sendFile(join(DIST_DIR, 'index.html'));
  });
}

app.listen(PORT, () => {
  const { contexts, commands } = getState();
  console.log(`✅ 上下文快捷键审校台已启动`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`   数据: ${contexts.length} 个上下文 / ${commands.length} 条命令`);
});
