// 初始演示数据：覆盖三类典型场景
//  - 同层相同序列冲突：编辑器 → 文本 下 "删除行" 与 "添加书签" 同为 ctrl+d
//  - 前缀冲突（含跨祖先）：全局 g 与 编辑器 g d；文本下 ' / ' d
//  - 子级覆盖祖先：文本 "删除整词" alt+d 覆盖全局 alt+d
export function seed() {
  const contexts = [
    { id: 'root', name: '全局', parentId: null },
    { id: 'editor', name: '编辑器', parentId: 'root' },
    { id: 'text', name: '文本编辑', parentId: 'editor' },
    { id: 'term', name: '终端', parentId: 'root' },
    { id: 'tree', name: '文件树', parentId: 'root' },
  ];

  const commands = [
    // ---- 全局 ----
    { id: 'cmd-save', name: '保存文件', contextId: 'root', seq: 'ctrl+s' },
    { id: 'cmd-find', name: '全局查找', contextId: 'root', seq: 'ctrl+f' },
    { id: 'cmd-goto', name: '跳转行号（前缀入口）', contextId: 'root', seq: 'g' },
    { id: 'cmd-goto-file', name: '跳转到文件', contextId: 'root', seq: 'ctrl+p' },
    { id: 'cmd-delete-word', name: '删除整词', contextId: 'root', seq: 'alt+d' },
    { id: 'cmd-quit', name: '退出', contextId: 'root', seq: 'ctrl+q' },

    // ---- 编辑器（自身制造一个前缀冲突：g d 与全局 g）----
    { id: 'cmd-dup-line', name: '复制当前行', contextId: 'editor', seq: 'ctrl+c ctrl+d' },
    { id: 'cmd-goto-def', name: '跳转到定义', contextId: 'editor', seq: 'g d' },

    // ---- 文本编辑（同层 ctrl+d 冲突 + 前缀冲突 'd 与 ' + 覆盖祖先 alt+d）----
    { id: 'cmd-delete-line', name: '删除整行', contextId: 'text', seq: 'ctrl+d' },
    { id: 'cmd-bookmark', name: '添加/取消书签', contextId: 'text', seq: 'ctrl+d' },
    { id: 'cmd-prefix-quote', name: '引号操作前缀', contextId: 'text', seq: "'" },
    { id: 'cmd-quote-double', name: '包裹双引号', contextId: 'text', seq: "' d" },
    { id: 'cmd-delete-word2', name: '删除整词（文本模式）', contextId: 'text', seq: 'alt+d' },

    // ---- 终端 ----
    { id: 'cmd-clear-term', name: '清屏', contextId: 'term', seq: 'ctrl+l' },
    { id: 'cmd-interrupt', name: '中断当前任务', contextId: 'term', seq: 'ctrl+c' },

    // ---- 文件树 ----
    { id: 'cmd-new-file', name: '新建文件', contextId: 'tree', seq: 'a' },
    { id: 'cmd-rename', name: '重命名', contextId: 'tree', seq: 'f2' },
  ];

  return { rootId: 'root', contexts, commands };
}
