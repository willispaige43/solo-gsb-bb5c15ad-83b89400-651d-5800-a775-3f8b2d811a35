import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import ContextTree from './ContextTree.jsx';
import CommandManager from './CommandManager.jsx';
import { EffectivePanel, ConflictPanel } from './Panels.jsx';
import Simulator from './Simulator.jsx';
import { Panel } from './ui.jsx';

export default function App() {
  const [state, setState] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [resolution, setResolution] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (ctxId) => {
    const nextState = await api.state();
    setState(nextState);
    const target = ctxId && nextState.contexts.some((c) => c.id === ctxId) ? ctxId : nextState.rootId;
    setSelectedId(target);
    const res = await api.resolve(target);
    setResolution(res);
  }, []);

  useEffect(() => {
    reload(null)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [reload]);

  const guard = async (fn) => {
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    }
  };

  // 数据变更后刷新，尽量保持当前选择；若被删除则退回根
  const mutate = (fn) => guard(async () => fn());

  async function refreshAfter(keepId = selectedId) {
    await reload(keepId);
  }

  if (loading) return <div className="app-loading">正在加载审校台…</div>;
  if (!state || !resolution) return <div className="app-loading">加载失败：{error || '未知错误'}</div>;

  const conflictCount = resolution.conflicts.length;
  const prefixCount = resolution.conflicts.filter((c) => c.kind === 'prefix').length;
  const dupCount = conflictCount - prefixCount;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">⌨</span>
          <div>
            <h1>上下文快捷键审校台</h1>
            <p>建立上下文树 · 最近祖先生效 · 子级覆盖祖先 · 冲突检测 · 逐键模拟</p>
          </div>
        </div>
        <div className="topbar-meta">
          <span className="meta-pill">{state.contexts.length} 上下文</span>
          <span className="meta-pill">{state.commands.length} 命令</span>
          <button
            className="btn ghost"
            onClick={() =>
              guard(async () => {
                await api.reset();
                await reload(null);
              })
            }
          >
            ↺ 重置演示数据
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner" onClick={() => setError('')}>
          ⚠ {error}（点击关闭）
        </div>
      )}

      <div className="layout">
        <aside className="sidebar">
          <Panel
            title="上下文树"
            extra={
              <button
                className="btn mini"
                onClick={() =>
                  mutate(async () => {
                    const name = window.prompt('在根上下文下新建上下文，名称：');
                    if (name && name.trim()) {
                      await api.addContext({ name: name.trim(), parentId: state.rootId });
                      await refreshAfter();
                    }
                  })
                }
              >
                ＋ 顶级
              </button>
            }
          >
            <ContextTree
              state={state}
              selectedId={selectedId}
              onSelect={(id) =>
                guard(async () => {
                  setSelectedId(id);
                  const res = await api.resolve(id);
                  setResolution(res);
                })
              }
              onAddChild={(parentId, name) =>
                mutate(async () => {
                  await api.addContext({ name, parentId });
                  await refreshAfter(parentId);
                })
              }
              onRename={(id, name) =>
                mutate(async () => {
                  await api.renameContext(id, name);
                  await refreshAfter();
                })
              }
              onDelete={(id) =>
                mutate(async () => {
                  await api.deleteContext(id);
                  await refreshAfter(id === selectedId ? state.rootId : selectedId);
                })
              }
            />
          </Panel>
        </aside>

        <main className="content">
          <div className="context-banner">
            <div className="context-banner-main">
              <span className="banner-label">当前审校上下文</span>
              <h2>
                {resolution.path.map((p, i) => (
                  <React.Fragment key={p.contextId}>
                    {i > 0 && <span className="crumb-sep">/</span>}
                    <span className={i === resolution.path.length - 1 ? 'crumb-here' : 'crumb'}>
                      {p.contextName}
                    </span>
                  </React.Fragment>
                ))}
              </h2>
            </div>
            <div className="conflict-summary">
              <span className={`summary-chip ${conflictCount ? 'hot' : 'ok'}`}>
                冲突 {conflictCount}
              </span>
              <span className={`summary-chip ${prefixCount ? 'hot' : 'ok'}`}>前缀 {prefixCount}</span>
              <span className={`summary-chip ${dupCount ? 'hot' : 'ok'}`}>同层重复 {dupCount}</span>
              <span className="summary-chip neutral">覆盖祖先 {resolution.shadowed.length}</span>
            </div>
          </div>

          <div className="grid">
            <div className="col">
              <Panel title="生效绑定" badge={resolution.effective.length} tone="bind">
                <EffectivePanel resolution={resolution} />
              </Panel>

              <Panel
                title="冲突审校"
                badge={conflictCount}
                tone={conflictCount ? 'danger' : 'ok'}
              >
                <ConflictPanel resolution={resolution} />
              </Panel>
            </div>

            <div className="col">
              <Panel title="逐键模拟" tone="sim">
                <Simulator resolution={resolution} />
              </Panel>

              <Panel title="命令定义" badge={state.commands.length}>
                <CommandManager
                  state={state}
                  selectedId={selectedId}
                  onAdd={(payload) =>
                    mutate(async () => {
                      const cmd = await api.addCommand(payload);
                      await refreshAfter(cmd.contextId);
                    })
                  }
                  onUpdate={(id, payload) =>
                    mutate(async () => {
                      const cmd = await api.updateCommand(id, payload);
                      await refreshAfter(cmd.contextId);
                    })
                  }
                  onDelete={(id) =>
                    mutate(async () => {
                      await api.deleteCommand(id);
                      await refreshAfter();
                    })
                  }
                />
              </Panel>
            </div>
          </div>
        </main>
      </div>

      <footer className="footer">
        序列 = 1～3 次按键，空格分隔多次按键（如 <code>g&nbsp;d</code>、
        <code>ctrl+k&nbsp;ctrl+t</code>）；最近祖先上下文的绑定生效，同层重复与前缀关系均会报出。
      </footer>
    </div>
  );
}
