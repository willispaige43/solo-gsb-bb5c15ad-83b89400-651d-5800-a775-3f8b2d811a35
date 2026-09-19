import { resolveBindings } from './server/resolve.js';
import { seed } from './server/seed.js';
import { canonicalSeq, canonicalToken } from './shared/key.js';
import assert from 'node:assert';

let pass = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  pass += 1;
  console.log(`  ✓ ${msg}`);
};

// ---- 按键规范化 ----
console.log('# 按键规范化');
ok(canonicalToken('Ctrl+K') === 'ctrl+k', 'Ctrl+K => ctrl+k');
ok(canonicalToken('CMD+SHIFT+P') === 'shift+meta+p', 'CMD+SHIFT+P => shift+meta+p（修饰键固定排序）');
ok(canonicalToken('Control+Alt+x') === 'ctrl+alt+x', 'Control+Alt+x => ctrl+alt+x');
ok(canonicalSeq('G  D') === 'g d', '多键空白规范化');
ok(canonicalSeq('a b c d') === null, '4 键序列非法');
ok(canonicalSeq('') === null, '空序列非法');
ok(canonicalSeq('a b c') === 'a b c', '3 键合法');

const state = seed();

// ---- 选中文本编辑：期望同层冲突 + 前缀冲突 + 覆盖 ----
console.log('\n# 选中 文本编辑(text)');
const res = resolveBindings(state, 'text');
const dup = res.conflicts.filter((c) => c.kind === 'same-seq');
const pre = res.conflicts.filter((c) => c.kind === 'prefix');
console.log('冲突:', JSON.stringify(res.conflicts.map((c) => [c.kind, c.trigger]), null, 0));

ok(dup.length === 1 && dup[0].seq === 'ctrl+d', '检测到 1 个同层 ctrl+d 冲突');
ok(dup[0].sources.length === 2, '同层冲突包含双方两条来源');
ok(dup[0].trigger === 'ctrl+d', '同层冲突最短触发输入 = ctrl+d');
ok(dup[0].sources.every((s) => s.path.includes('文本编辑')), '来源路径展示到文本编辑');

const gPrefix = pre.find((c) => c.trigger === 'g');
ok(!!gPrefix, '检测到跨祖先前缀冲突 g <-> g d');
ok(
  gPrefix.sources.some((s) => s.role === 'prefix' && s.commandId === 'cmd-goto') &&
    gPrefix.sources.some((s) => s.role === 'extension' && s.commandId === 'cmd-goto-def'),
  '前缀冲突双方来源与角色正确（全局 g / 编辑器 g d）'
);
ok(pre.some((c) => c.trigger === "'"), "文本层前缀冲突 ' <-> ' d");

// alt+d：子级覆盖祖先
const altWinner = res.effective.find((e) => e.seq === 'alt+d');
ok(altWinner.commandId === 'cmd-delete-word2', 'alt+d 生效的是文本编辑子级命令');
const altShadow = res.shadowed.find((s) => s.seq === 'alt+d');
ok(!!altShadow && altShadow.commandId === 'cmd-delete-word', '全局 alt+d 进入被覆盖列表');
ok(altShadow.overriddenBy.commandId === 'cmd-delete-word2', '覆盖来源指向子级命令');

// ctrl+d 最近层歧义：两条都在 effective 且 ambiguous
const cdEff = res.effective.filter((e) => e.seq === 'ctrl+d');
ok(cdEff.length === 2 && cdEff.every((e) => e.ambiguous), '同层冲突的两条命令均展示为歧义生效');

// ---- 选中根：无冲突（g 与 g l 是前缀！根下也有前缀冲突）----
console.log('\n# 选中 全局(root)');
const rootRes = resolveBindings(state, 'root');
console.log('冲突:', rootRes.conflicts.map((c) => [c.kind, c.trigger]));
ok(
  !rootRes.conflicts.some((c) => c.kind === 'prefix'),
  '根上下文自身无前缀冲突'
);
ok(!rootRes.conflicts.some((c) => c.kind === 'same-seq'), '根上下文无同层冲突');
ok(rootRes.shadowed.length === 0, '根上下文无被覆盖项');

// ---- 选中终端：分支隔离 ----
console.log('\n# 选中 终端(term)');
const termRes = resolveBindings(state, 'term');
ok(!termRes.effective.some((e) => e.seq === 'f2'), '兄弟分支文件树的 f2 不生效');
ok(termRes.effective.some((e) => e.seq === 'ctrl+s'), '全局 ctrl+s 在终端生效');
ok(termRes.effective.some((e) => e.seq === 'ctrl+l'), '终端自有 ctrl+l 生效');
ok(
  !termRes.conflicts.some((c) => c.kind === 'prefix'),
  '终端链上无前缀冲突（编辑器分支命令不参与，根自身干净）'
);

// ---- 选中文件树：a 单键无冲突 ----
console.log('\n# 选中 文件树(tree)');
const treeRes = resolveBindings(state, 'tree');
ok(treeRes.effective.some((e) => e.seq === 'a'), '文件树 a 生效');

// ---- 深层新增上下文覆盖行为 ----
console.log('\n# 深层子级唯一覆盖不产生冲突');
const state2 = {
  rootId: 'r',
  contexts: [
    { id: 'r', name: 'R', parentId: null },
    { id: 'c1', name: 'C1', parentId: 'r' },
    { id: 'c2', name: 'C2', parentId: 'c1' },
  ],
  commands: [
    { id: 'x1', name: 'X1', contextId: 'r', seq: 'ctrl+k' },
    { id: 'x2', name: 'X2', contextId: 'c2', seq: 'ctrl+k' },
  ],
};
const r2 = resolveBindings(state2, 'c2');
ok(r2.effective.find((e) => e.seq === 'ctrl+k').commandId === 'x2', '最近祖先命令生效');
ok(r2.shadowed.length === 1, '祖先命令被覆盖');
ok(r2.conflicts.length === 0, '唯一覆盖不产生冲突');

// 祖先层重复 + 深层唯一：覆盖展示但同层冲突仍报出
const state3 = {
  rootId: 'r',
  contexts: [
    { id: 'r', name: 'R', parentId: null },
    { id: 'c1', name: 'C1', parentId: 'r' },
  ],
  commands: [
    { id: 'a1', name: 'A1', contextId: 'r', seq: 'ctrl+k' },
    { id: 'a2', name: 'A2', contextId: 'r', seq: 'ctrl+k' },
    { id: 'b1', name: 'B1', contextId: 'c1', seq: 'ctrl+k' },
  ],
};
const r3 = resolveBindings(state3, 'c1');
ok(!r3.conflicts.some((c) => c.kind === 'same-seq'), '祖先层同层重复已被深层唯一定义覆盖时不再报冲突');
ok(r3.effective.find((e) => e.seq === 'ctrl+k').commandId === 'b1', '深层唯一定义为赢家');
ok(r3.shadowed.length === 2, '两条祖先命令都进入覆盖区');

console.log(`\n全部 ${pass} 项断言通过 ✅`);
