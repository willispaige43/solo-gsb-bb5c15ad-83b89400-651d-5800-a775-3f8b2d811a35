// 把浏览器 keydown 事件转成规范化 token（仅浏览器端使用）
import { canonicalToken } from '../shared/key.js';

const NAMED_KEYS = new Map([
  ['Escape', 'esc'],
  [' ', 'space'],
  ['Spacebar', 'space'],
  ['Enter', 'enter'],
  ['Tab', 'tab'],
  ['Backspace', 'backspace'],
  ['Delete', 'del'],
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['F1', 'f1'],
  ['F2', 'f2'],
  ['F3', 'f3'],
  ['F4', 'f4'],
  ['F5', 'f5'],
  ['F6', 'f6'],
  ['F7', 'f7'],
  ['F8', 'f8'],
  ['F9', 'f9'],
  ['F10', 'f10'],
  ['F11', 'f11'],
  ['F12', 'f12'],
]);

export const BACKSPACE = '__backspace__';
export const ESC = '__esc__';

// 返回 null 表示该事件不构成一次按键（仅修饰键按下 / 自动重复）
export function eventToToken(e) {
  if (e.repeat) return null;

  if (e.key === 'Backspace') return BACKSPACE;
  if (e.key === 'Escape') return ESC;

  const parts = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  if (e.metaKey) parts.push('meta');

  const main = NAMED_KEYS.get(e.key) || (e.key && e.key.length === 1 ? e.key : '');
  // 单独按下修饰键不产生 token
  if (!main) return null;

  parts.push(main);
  return canonicalToken(parts.join('+'));
}
