// 按键规范化：前后端共用同一套规则，保证"输入什么"和"存了什么"一定能匹配上。
// 单次按键 token 形如：ctrl+k、alt+shift+x、a、f1、space、esc、enter
// 一个序列由 1~3 个 token 组成，token 之间用空格分隔，例如 "g d"、"ctrl+k ctrl+t"

const MOD_ALIASES = {
  control: 'ctrl',
  ctl: 'ctrl',
  ctrl: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  win: 'meta',
};

const KEY_ALIASES = {
  escape: 'esc',
  esc: 'esc',
  spacebar: 'space',
  ' ': 'space',
  space: 'space',
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  return: 'enter',
  enter: 'enter',
  backspace: 'backspace',
  delete: 'del',
  del: 'del',
  tab: 'tab',
  plus: '+',
};

// 规范化单次按键描述
export function canonicalToken(raw) {
  if (raw == null) return '';
  const parts = String(raw)
    .trim()
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';

  const mods = new Set();
  let main = '';
  for (const p of parts) {
    if (MOD_ALIASES[p]) mods.add(MOD_ALIASES[p]);
    else if (!main) main = KEY_ALIASES[p] || p;
  }
  if (!main) return '';

  // 单字符主键保持小写（A 与 a 视为同一键，大小写由 shift 修饰表达）
  if (main.length === 1) main = main.toLowerCase();

  const order = ['ctrl', 'alt', 'shift', 'meta'];
  return [...order.filter((m) => mods.has(m)), main].join('+');
}

// 规范化序列；非法（空/超过 3 键）时返回 null
export function canonicalSeq(raw) {
  if (raw == null) return null;
  const tokens = String(raw)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(canonicalToken)
    .filter(Boolean);
  if (tokens.length < 1 || tokens.length > 3) return null;
  return tokens.join(' ');
}

// 去掉修饰键的纯主键（用于触发判定之外的展示辅助）
export function plainKey(token) {
  return token.split('+').pop();
}
