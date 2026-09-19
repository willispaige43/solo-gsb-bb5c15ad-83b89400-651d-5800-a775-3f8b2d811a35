import { canonicalSeq } from '../shared/key.js';

// ---------------------------------------------------------------------------
// 最近祖先规则解析
//
// 选中某上下文 ctx 后，生效绑定 = 从根到 ctx 这条祖先链上的全部命令。
// 对同一个序列：
//   - 链上"最靠近 ctx"的上下文中的命令生效；
//   - 更深层的命令覆盖祖先（shadow），祖先命令保留展示但标记为"被覆盖"；
//   - 同一上下文内若有多条命令使用同一序列，全部标记为"同层序列冲突"，
//     彼此没有赢家，且无法再被更深层覆盖（上层歧义向下传导）。
//
// 前缀冲突：生效绑定之间，序列 A 是序列 B 的严格前缀（A.length < B.length）。
// 即按 A 时命令 A 已经可触发，B 只能等后续按键 —— 二者互相干扰，必须报出。
// ---------------------------------------------------------------------------

function buildPath(contexts, rootId, targetId) {
  const byId = new Map(contexts.map((c) => [c.id, c]));
  const chainIds = [];
  let cur = byId.get(targetId);
  while (cur) {
    chainIds.unshift(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  // targetId 非法时，退化为根
  if (chainIds.length === 0 && rootId) chainIds.push(rootId);
  return chainIds;
}

function pathLabel(contexts, chainIds, upToIndex) {
  const byId = new Map(contexts.map((c) => [c.id, c]));
  return chainIds
    .slice(0, upToIndex + 1)
    .map((id) => (byId.get(id) || { name: id }).name)
    .join(' / ');
}

export function resolveBindings(rawState, targetId) {
  const { rootId, contexts, commands } = rawState;
  const byId = new Map(contexts.map((c) => [c.id, c]));
  const chainIds = buildPath(contexts, rootId, targetId);
  const chainSet = new Set(chainIds);
  const depthOf = new Map(chainIds.map((id, i) => [id, i]));

  // 先规范化所有命令序列（兼容历史/直接写入的未规范化数据）
  const normalized = commands
    .map((cmd) => {
      const seq = canonicalSeq(cmd.seq);
      return { ...cmd, seq };
    })
    .filter((cmd) => cmd.seq && chainSet.has(cmd.contextId));

  // 按序列分组
  const groups = new Map();
  for (const cmd of normalized) {
    if (!groups.has(cmd.seq)) groups.set(cmd.seq, []);
    groups.get(cmd.seq).push(cmd);
  }

  const effective = []; // 生效条目
  const shadowed = []; // 被后代覆盖的祖先命令
  const conflicts = []; // 冲突（同层 + 前缀）

  // 同层相同序列冲突 + 选出每个序列的赢家
  const winners = new Map(); // seq -> 生效命令数组
  for (const [seq, cmds] of groups) {
    // 按上下文层级分桶
    const buckets = new Map();
    for (const cmd of cmds) {
      const d = depthOf.get(cmd.contextId);
      if (!buckets.has(d)) buckets.set(d, []);
      buckets.get(d).push(cmd);
    }

    // 同层重复只在"生效层（最深层）"判定：祖先层的重复若已被更深层的唯一定义
    // 完整覆盖，则按最近祖先规则在当前上下文已经消解，仅在覆盖区展示即可。
    const maxDepth = Math.max(...buckets.keys());
    const deepest = buckets.get(maxDepth);
    if (deepest.length > 1) {
      conflicts.push({
        type: 'duplicate',
        kind: 'same-seq',
        seq,
        trigger: seq, // 最短触发输入就是序列本身
        contextId: deepest[0].contextId,
        contextName: (byId.get(deepest[0].contextId) || {}).name || '',
        sources: deepest.map((cmd) => ({
          commandId: cmd.id,
          commandName: cmd.name,
          contextId: cmd.contextId,
          contextName: (byId.get(cmd.contextId) || {}).name || '',
          path: pathLabel(contexts, chainIds, maxDepth),
          depth: maxDepth,
          seq,
        })),
      });
    }

    if (deepest.length > 1) {
      // 最近层本身歧义：没有赢家，全部按冲突命令展示
      for (const cmd of deepest) {
        effective.push({
          commandId: cmd.id,
          commandName: cmd.name,
          seq,
          contextId: cmd.contextId,
          contextName: (byId.get(cmd.contextId) || {}).name || '',
          path: pathLabel(contexts, chainIds, maxDepth),
          depth: maxDepth,
          ambiguous: true,
          shadowed: false,
        });
      }
    } else {
      const winner = deepest[0];
      winners.set(seq, winner);
      effective.push({
        commandId: winner.id,
        commandName: winner.name,
        seq,
        contextId: winner.contextId,
        contextName: (byId.get(winner.contextId) || {}).name || '',
        path: pathLabel(contexts, chainIds, maxDepth),
        depth: maxDepth,
        ambiguous: false,
        shadowed: false,
      });
    }

    // 其余祖先层命令：被覆盖
    for (const [d, layerCmds] of buckets) {
      if (d === maxDepth) continue;
      for (const cmd of layerCmds) {
        shadowed.push({
          commandId: cmd.id,
          commandName: cmd.name,
          seq,
          contextId: cmd.contextId,
          contextName: (byId.get(cmd.contextId) || {}).name || '',
          path: pathLabel(contexts, chainIds, d),
          depth: d,
          overriddenBy:
            deepest.length === 1
              ? {
                  commandId: deepest[0].id,
                  commandName: deepest[0].name,
                  contextId: deepest[0].contextId,
                  contextName: (byId.get(deepest[0].contextId) || {}).name || '',
                  path: pathLabel(contexts, chainIds, maxDepth),
                }
              : null,
        });
      }
    }
  }

  // 排序：层级深的在前，同级按序列字典序
  effective.sort((a, b) => b.depth - a.depth || a.seq.localeCompare(b.seq));
  shadowed.sort((a, b) => b.depth - a.depth || a.seq.localeCompare(b.seq));

  // 前缀冲突：只在"无歧义的生效赢家"之间检测。
  // A 严格为 B 前缀 => 最短触发输入是 A（按下 A 时 A 已可触发，B 永远要多等）。
  const winnerList = [...winners.entries()]
    .map(([seq, cmd]) => ({
      seq,
      tokens: seq.split(' '),
      commandId: cmd.id,
      commandName: cmd.name,
      contextId: cmd.contextId,
      contextName: (byId.get(cmd.contextId) || {}).name || '',
      depth: depthOf.get(cmd.contextId),
    }))
    .sort((a, b) => a.tokens.length - b.tokens.length || a.seq.localeCompare(b.seq));

  const isPrefix = (shorter, longer) =>
    shorter.length < longer.length && shorter.every((t, i) => t === longer[i]);

  for (let i = 0; i < winnerList.length; i++) {
    for (let j = i + 1; j < winnerList.length; j++) {
      const a = winnerList[i];
      const b = winnerList[j];
      if (a.tokens.length >= b.tokens.length) continue;
      if (!isPrefix(a.tokens, b.tokens)) continue;
      conflicts.push({
        type: 'prefix',
        kind: 'prefix',
        seq: a.seq,
        trigger: a.seq, // 最短触发输入 = 前缀序列
        sources: [
          {
            commandId: a.commandId,
            commandName: a.commandName,
            contextId: a.contextId,
            contextName: a.contextName,
            path: pathLabel(contexts, chainIds, a.depth),
            depth: a.depth,
            seq: a.seq,
            role: 'prefix',
          },
          {
            commandId: b.commandId,
            commandName: b.commandName,
            contextId: b.contextId,
            contextName: b.contextName,
            path: pathLabel(contexts, chainIds, b.depth),
            depth: b.depth,
            seq: b.seq,
            role: 'extension',
          },
        ],
      });
    }
  }

  // 冲突展示顺序：先前缀后同层；同类型按最短触发输入排序
  conflicts.sort((a, b) =>
    a.kind === b.kind ? a.trigger.localeCompare(b.trigger) : a.kind === 'prefix' ? -1 : 1
  );

  return {
    contextId: targetId,
    contextName: (byId.get(targetId) || {}).name || targetId,
    path: chainIds.map((id, i) => ({
      contextId: id,
      contextName: (byId.get(id) || {}).name || id,
      depth: i,
      label: pathLabel(contexts, chainIds, i),
    })),
    effective,
    shadowed,
    conflicts,
  };
}
