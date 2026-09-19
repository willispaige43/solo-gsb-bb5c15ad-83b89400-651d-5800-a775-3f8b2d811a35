import React, { useState } from 'react';

// 把扁平上下文数组构建成树
export function buildTree(contexts, rootId) {
  const byId = new Map(contexts.map((c) => [c.id, { ...c, children: [] }]));
  let root = null;
  for (const node of byId.values()) {
    if (node.id === rootId) {
      root = node;
    } else if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId).children.push(node);
    }
  }
  return root;
}

function TreeNode({ node, depth, selectedId, onSelect, onAddChild, onRename, onDelete, isRoot }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(node.name);
  const [childName, setChildName] = useState('');

  const selected = node.id === selectedId;

  function commitRename() {
    const name = draft.trim();
    if (name && name !== node.name) onRename(node.id, name);
    setEditing(false);
    setDraft(node.name);
  }

  function commitAdd() {
    const name = childName.trim();
    if (name) onAddChild(node.id, name);
    setChildName('');
    setAdding(false);
  }

  return (
    <div className="tree-node">
      <div
        className={`tree-row ${selected ? 'selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 18 }}
        onClick={() => onSelect(node.id)}
      >
        <span className="tree-twisty">{node.children.length > 0 ? '▾' : '•'}</span>
        {editing ? (
          <input
            autoFocus
            className="tree-name-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setEditing(false);
                setDraft(node.name);
              }
            }}
            onBlur={commitRename}
          />
        ) : (
          <span className="tree-name">{node.name}</span>
        )}
        <span className="tree-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="icon-btn"
            title="添加子上下文"
            onClick={() => {
              setAdding((v) => !v);
              onSelect(node.id);
            }}
          >
            ＋
          </button>
          {!isRoot && (
            <>
              <button className="icon-btn" title="重命名" onClick={() => setEditing(true)}>
                ✎
              </button>
              <button
                className="icon-btn danger"
                title="删除（含全部子级与其命令）"
                onClick={() => {
                  if (window.confirm(`删除上下文「${node.name}」及其全部子级和命令？`)) onDelete(node.id);
                }}
              >
                ✕
              </button>
            </>
          )}
        </span>
      </div>

      {adding && (
        <div className="tree-add-row" style={{ paddingLeft: 8 + (depth + 1) * 18 }}>
          <input
            autoFocus
            className="tree-name-input"
            placeholder="新上下文名称，回车确认"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commitAdd();
              if (e.key === 'Escape') setAdding(false);
            }}
            onBlur={commitAdd}
          />
        </div>
      )}

      {node.children
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            onAddChild={onAddChild}
            onRename={onRename}
            onDelete={onDelete}
            isRoot={false}
          />
        ))}
    </div>
  );
}

export default function ContextTree({ state, selectedId, onSelect, onAddChild, onRename, onDelete }) {
  const tree = buildTree(state.contexts, state.rootId);
  if (!tree) return null;
  return (
    <div className="context-tree">
      <TreeNode
        node={tree}
        depth={0}
        selectedId={selectedId}
        onSelect={onSelect}
        onAddChild={onAddChild}
        onRename={onRename}
        onDelete={onDelete}
        isRoot
      />
    </div>
  );
}
