import React, { useRef, useState } from 'react';
import { eventToToken, BACKSPACE, ESC } from './keyEvent.js';

// 键位徽章：ctrl + k 这种组合渲染成一组 kbd
export function TokenBadges({ seq, dim = false, prefix = 0 }) {
  const tokens = (seq || '').split(' ').filter(Boolean);
  if (tokens.length === 0) return <span className="badge-empty">—</span>;
  return (
    <span className={`token-seq ${dim ? 'dim' : ''}`}>
      {tokens.map((token, i) => {
        const keys = token.split('+');
        const isNew = i >= prefix;
        return (
          <span key={i} className={`token-group ${isNew ? 'is-new' : ''}`}>
            {keys.map((k, j) => (
              <kbd key={j} className={`keycap ${isNew ? 'keycap-new' : ''}`}>
                {k}
              </kbd>
            ))}
            {i < tokens.length - 1 && <span className="token-gap" />}
          </span>
        );
      })}
    </span>
  );
}

// 按键录制框：聚焦后直接按下快捷键即可录入，Backspace 删除末键，Esc 失焦
export function KeyCaptureInput({ value, onChange, maxTokens = 3, placeholder = '点击此处后直接按键…' }) {
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const tokens = (value || '').split(' ').filter(Boolean);

  function handleKeyDown(e) {
    const token = eventToToken(e);
    e.preventDefault();
    e.stopPropagation();
    if (token === BACKSPACE) {
      onChange(tokens.slice(0, -1).join(' '));
      return;
    }
    if (token === ESC) {
      ref.current?.blur();
      return;
    }
    if (!token) return;
    if (tokens.length >= maxTokens) return;
    onChange([...tokens, token].join(' '));
  }

  return (
    <div className="capture-wrap">
      <div
        ref={ref}
        tabIndex={0}
        className={`capture-box ${focused ? 'focused' : ''}`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
      >
        {tokens.length > 0 ? (
          <TokenBadges seq={value} />
        ) : (
          <span className="capture-placeholder">{focused ? '请按键…' : placeholder}</span>
        )}
      </div>
      {focused && (
        <div className="capture-hint">
          直接按下快捷键 · 最多 {maxTokens} 键 · <kbd className="keycap mini">Backspace</kbd> 删除 ·{' '}
          <kbd className="keycap mini">Esc</kbd> 完成
        </div>
      )}
    </div>
  );
}

// 面板容器
export function Panel({ title, badge, tone = 'default', extra, children }) {
  return (
    <section className={`panel panel-${tone}`}>
      <header className="panel-head">
        <h2>
          {title}
          {badge != null && <span className="panel-badge">{badge}</span>}
        </h2>
        {extra}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
