import React, { useEffect, useMemo, useState } from 'react';
import { TokenBadges } from './ui.jsx';
import { eventToToken, BACKSPACE, ESC } from './keyEvent.js';

// 逐键模拟器：
//   每按一键，计算当前缓冲与生效绑定的关系 ——
//   triggered  已有绑定与缓冲完全一致（立即触发；多条即歧义触发）
//   waiting    没有完全一致，但存在以缓冲为前缀的绑定（等待后续按键）
//   no-match   既不能触发也没有候选（键不匹配，下一键将重新开始）
export default function Simulator({ resolution }) {
  const [buffer, setBuffer] = useState([]);
  const [settled, setSettled] = useState(false);

  // 切换上下文 / 绑定变化时清空
  useEffect(() => {
    setBuffer([]);
    setSettled(false);
  }, [resolution.contextId, resolution.effective]);

  const entries = useMemo(
    () =>
      resolution.effective.map((e) => ({
        commandId: e.commandId,
        commandName: e.commandName,
        contextName: e.contextName,
        path: e.path,
        ambiguous: e.ambiguous,
        tokens: e.seq.split(' '),
      })),
    [resolution.effective]
  );

  const view = useMemo(() => {
    if (buffer.length === 0) return { status: 'idle', exact: [], candidates: [] };

    const exact = entries.filter((e) => e.tokens.length === buffer.length && e.tokens.every((t, i) => t === buffer[i]));
    const candidates = entries.filter(
      (e) =>
        e.tokens.length > buffer.length && e.tokens.slice(0, buffer.length).every((t, i) => t === buffer[i])
    );

    if (exact.length > 0) return { status: 'triggered', exact, candidates };
    if (candidates.length > 0) return { status: 'waiting', exact: [], candidates };
    return { status: 'no-match', exact: [], candidates: [] };
  }, [buffer, entries]);

  function press(token) {
    // 触发完成 / 无匹配后，下一键视为新一轮输入
    const base = settled ? [] : buffer;
    if (base.length >= 3) return;
    const next = [...base, token];

    const exact = entries.filter(
      (e) => e.tokens.length === next.length && e.tokens.every((t, i) => t === next[i])
    );
    const candidates = entries.filter(
      (e) => e.tokens.length > next.length && e.tokens.slice(0, next.length).every((t, i) => t === next[i])
    );

    setBuffer(next);
    setSettled(exact.length > 0 || (exact.length === 0 && candidates.length === 0));
  }

  function handleKeyDown(e) {
    const token = eventToToken(e);
    e.preventDefault();
    e.stopPropagation();
    if (token === BACKSPACE) {
      setBuffer((b) => b.slice(0, -1));
      setSettled(false);
      return;
    }
    if (token === ESC) {
      setBuffer([]);
      setSettled(false);
      return;
    }
    if (token) press(token);
  }

  const statusMap = {
    idle: { cls: 'st-idle', text: '等待按键 —— 点击下方捕获区后直接输入快捷键' },
    waiting: {
      cls: 'st-waiting',
      text: `等待后续按键：${view.candidates.length} 个候选序列以当前输入为前缀`,
    },
    triggered:
      view.exact.length > 1 || view.exact.some((e) => e.ambiguous)
        ? { cls: 'st-ambiguous', text: '⚠ 已触发，但命中多条命令（歧义！）' }
        : { cls: 'st-triggered', text: '✓ 已触发命令' },
    'no-match': { cls: 'st-nomatch', text: '✕ 无匹配绑定：没有命令以当前输入开头，下一次按键将重新开始' },
  };
  const status = statusMap[view.status];

  return (
    <div className="simulator">
      <div
        className="sim-capture"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.currentTarget.focus()}
      >
        <div className="sim-buffer">
          {buffer.length === 0 ? (
            <span className="sim-placeholder">点击此处捕获按键…</span>
          ) : (
            <TokenBadges seq={buffer.join(' ')} />
          )}
        </div>
        <div
          className="sim-actions"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            className="btn mini ghost"
            onClick={(e) => {
              e.stopPropagation();
              setBuffer((b) => b.slice(0, -1));
              setSettled(false);
            }}
          >
            ⌫ 删除末键
          </button>
          <button
            className="btn mini ghost"
            onClick={(e) => {
              e.stopPropagation();
              setBuffer([]);
              setSettled(false);
            }}
          >
            Esc 清空
          </button>
        </div>
      </div>

      <div className={`sim-status ${status.cls}`}>{status.text}</div>

      {view.status === 'triggered' && (
        <ul className="sim-triggered-list">
          {view.exact.map((e) => (
            <li
              key={e.commandId}
              className={`sim-triggered ${e.ambiguous || view.exact.length > 1 ? 'ambiguous' : ''}`}
            >
              <span className="fire-mark">{e.ambiguous || view.exact.length > 1 ? '⚠' : '▶'}</span>
              <strong>{e.commandName}</strong>
              <span className="dim-text">（{e.path}）</span>
            </li>
          ))}
        </ul>
      )}

      {(view.status === 'waiting' || view.status === 'triggered') && view.candidates.length > 0 && (
        <div className="sim-candidates">
          <h4>候选命令（继续按键收敛，最短完整序列即可触发）</h4>
          <ul>
            {view.candidates.map((e) => (
              <li key={`c-${e.commandId}`} className="sim-candidate">
                <TokenBadges seq={e.tokens.join(' ')} prefix={buffer.length} />
                <span className="candidate-name">{e.commandName}</span>
                <span className="dim-text">{e.contextName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="sim-help">
        规则：只统计「生效绑定」（子级覆盖祖先）；1～3 次按键为一个序列；修饰键组合（如{' '}
        <kbd className="keycap mini">ctrl</kbd>+<kbd className="keycap mini">k</kbd>）算一次按键。
      </div>
    </div>
  );
}
