import React, { useState } from 'react';
import { KeyCaptureInput, TokenBadges } from './ui.jsx';

function ContextSelect({ contexts, value, onChange }) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      {contexts.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

// 列出当前上下文链上的全部命令（即"参与生效计算"的原始定义），可就地编辑
export default function CommandManager({ state, selectedId, onAdd, onUpdate, onDelete }) {
  const [name, setName] = useState('');
  const [seq, setSeq] = useState('');
  const [contextId, setContextId] = useState(selectedId);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', seq: '', contextId: '' });

  // 选中上下文变化时，新建命令默认归属该上下文
  React.useEffect(() => {
    setContextId(selectedId);
  }, [selectedId]);

  const byId = new Map(state.contexts.map((c) => [c.id, c]));

  // 计算祖先链，只展示链上命令（与解析口径一致）
  const chainIds = [];
  let cur = byId.get(selectedId);
  while (cur) {
    chainIds.unshift(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  const chainSet = new Set(chainIds);
  const commands = state.commands
    .filter((cmd) => chainSet.has(cmd.contextId))
    .sort((a, b) => {
      const da = chainIds.indexOf(a.contextId);
      const db = chainIds.indexOf(b.contextId);
      return da - db || a.seq.localeCompare(b.seq);
    });

  async function handleAdd() {
    setError('');
    try {
      await onAdd({ name: name.trim(), seq, contextId });
      setName('');
      setSeq('');
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(cmd) {
    setEditingId(cmd.id);
    setEditDraft({ name: cmd.name, seq: cmd.seq, contextId: cmd.contextId });
  }

  async function commitEdit() {
    try {
      await onUpdate(editingId, editDraft);
      setEditingId(null);
    } catch (err) {
      window.alert(err.message);
    }
  }

  return (
    <div className="cmd-manager">
      <div className="cmd-add">
        <input
          className="field grow"
          placeholder="命令名称，如：保存文件"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <KeyCaptureInput value={seq} onChange={setSeq} maxTokens={3} placeholder="录制按键序列" />
        <ContextSelect contexts={state.contexts} value={contextId} onChange={setContextId} />
        <button className="btn primary" onClick={handleAdd} disabled={!name.trim() || !seq}>
          添加命令
        </button>
      </div>
      {error && <div className="form-error">⚠ {error}</div>}

      <ul className="cmd-list">
        {commands.length === 0 && <li className="muted-note">该上下文及其祖先链上还没有定义命令。</li>}
        {commands.map((cmd) => {
          const ctx = byId.get(cmd.contextId);
          const isOwner = cmd.contextId === selectedId;
          return (
            <li key={cmd.id} className={`cmd-row ${isOwner ? '' : 'from-ancestor'}`}>
              {editingId === cmd.id ? (
                <div className="cmd-edit">
                  <input
                    className="field"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  />
                  <KeyCaptureInput
                    value={editDraft.seq}
                    onChange={(v) => setEditDraft({ ...editDraft, seq: v })}
                    maxTokens={3}
                    placeholder="序列"
                  />
                  <ContextSelect
                    contexts={state.contexts}
                    value={editDraft.contextId}
                    onChange={(v) => setEditDraft({ ...editDraft, contextId: v })}
                  />
                  <button className="btn mini" onClick={commitEdit}>
                    保存
                  </button>
                  <button className="btn mini ghost" onClick={() => setEditingId(null)}>
                    取消
                  </button>
                </div>
              ) : (
                <>
                  <span className="cmd-name" title={cmd.name}>
                    {cmd.name}
                  </span>
                  <TokenBadges seq={cmd.seq} />
                  <span className={`cmd-ctx ${isOwner ? 'owner' : 'ancestor'}`}>
                    {isOwner ? '本上下文' : `继承自 · ${ctx ? ctx.name : cmd.contextId}`}
                  </span>
                  <span className="cmd-ops">
                    <button className="icon-btn" title="编辑" onClick={() => startEdit(cmd)}>
                      ✎
                    </button>
                    <button
                      className="icon-btn danger"
                      title="删除命令"
                      onClick={() => {
                        if (window.confirm(`删除命令「${cmd.name}」？`)) onDelete(cmd.id);
                      }}
                    >
                      ✕
                    </button>
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
