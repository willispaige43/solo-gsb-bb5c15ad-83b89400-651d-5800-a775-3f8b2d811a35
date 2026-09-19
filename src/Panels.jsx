import React from 'react';
import { TokenBadges } from './ui.jsx';

// 生效绑定 + 被覆盖祖先
export function EffectivePanel({ resolution }) {
  const { effective, shadowed } = resolution;
  return (
    <div className="effective-panel">
      <ul className="binding-list">
        {effective.map((b) => (
          <li key={`${b.commandId}-${b.seq}`} className={`binding-row ${b.ambiguous ? 'ambiguous' : ''}`}>
            <TokenBadges seq={b.seq} />
            <span className="binding-cmd" title={b.commandName}>
              {b.commandName}
            </span>
            <span className="binding-src" title={b.path}>
              {b.contextName}
            </span>
            {b.ambiguous && <span className="tag tag-danger">歧义 · 同层重复</span>}
            {b.depth > 0 && <span className="tag tag-ghost">深度 {b.depth} · 覆盖祖先</span>}
          </li>
        ))}
      </ul>

      {shadowed.length > 0 && (
        <div className="shadowed-block">
          <h3>被后代覆盖的祖先绑定（{shadowed.length}）</h3>
          <ul className="binding-list">
            {shadowed.map((b) => (
              <li key={`${b.commandId}-${b.seq}`} className="binding-row shadowed-row">
                <TokenBadges seq={b.seq} dim />
                <span className="binding-cmd dim-text">{b.commandName}</span>
                <span className="binding-src dim-text" title={b.path}>
                  {b.contextName}
                </span>
                <span className="tag tag-muted">
                  被覆盖
                  {b.overriddenBy && (
                    <>
                      {' '}
                      → {b.overriddenBy.contextName} · {b.overriddenBy.commandName}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SourceLine({ src, role }) {
  const roleTag =
    role === 'prefix' ? (
      <span className="tag tag-warn">短序列 · 立即触发方</span>
    ) : role === 'extension' ? (
      <span className="tag tag-info">长序列 · 等待后续键</span>
    ) : null;
  return (
    <div className="conflict-source">
      <TokenBadges seq={src.seq} />
      <div className="conflict-source-meta">
        <div className="conflict-source-name">{src.commandName}</div>
        <div className="conflict-source-path">
          来源：{src.path}
          <span className="depth-pill">深度 {src.depth}</span>
        </div>
      </div>
      {roleTag}
    </div>
  );
}

// 冲突面板：前缀冲突 + 同层序列冲突，给出双方来源与最短触发输入
export function ConflictPanel({ resolution }) {
  const { conflicts } = resolution;
  if (conflicts.length === 0) {
    return (
      <div className="clean-state">
        <span className="clean-icon">✓</span> 当前上下文的生效绑定没有冲突。
      </div>
    );
  }

  const prefixes = conflicts.filter((c) => c.kind === 'prefix');
  const duplicates = conflicts.filter((c) => c.kind === 'same-seq');

  return (
    <div className="conflict-panel">
      {prefixes.map((c, i) => (
        <div key={`p-${i}`} className="conflict-card prefix-card">
          <div className="conflict-title">
            <span className="conflict-badge">前缀冲突</span>
            <span>
              一个序列是另一个序列的前缀。按下最短触发输入{' '}
              <strong className="trigger-seq">「{c.trigger}」</strong> 时短序列命令已触发，长序列只能等待。
            </span>
          </div>
          {c.sources.map((src, j) => (
            <SourceLine key={j} src={src} role={src.role} />
          ))}
          <div className="conflict-foot">
            最短触发输入：<TokenBadges seq={c.trigger} />
          </div>
        </div>
      ))}

      {duplicates.map((c, i) => (
        <div key={`d-${i}`} className="conflict-card duplicate-card">
          <div className="conflict-title">
            <span className="conflict-badge danger-badge">同层序列冲突</span>
            <span>
              同一上下文「{c.contextName}」中有多条命令绑定到同一序列{' '}
              <strong className="trigger-seq">「{c.trigger}」</strong>，按键后无法确定目标。
            </span>
          </div>
          {c.sources.map((src, j) => (
            <SourceLine key={j} src={src} role="dup" />
          ))}
          <div className="conflict-foot">
            最短触发输入：<TokenBadges seq={c.trigger} />
          </div>
        </div>
      ))}
    </div>
  );
}
