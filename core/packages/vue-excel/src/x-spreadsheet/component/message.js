import { h } from './element';
import Icon from './icon';
import { bind, unbind } from './event';
import { cssPrefix } from '../config';

const activeToastRemovers = new Set();

export function clearToasts() {
  Array.from(activeToastRemovers).forEach(fn => fn());
}

export function xtoast(title, content) {
  if (typeof document === 'undefined' || !document.body) {
    return () => {};
  }
  const el = h('div', `${cssPrefix}-toast`);
  const dimmer = h('div', `${cssPrefix}-dimmer active`);
  let onEsc = null;
  const remove = () => {
    activeToastRemovers.delete(remove);
    if (onEsc && typeof window !== 'undefined') {
      unbind(window, 'keydown', onEsc);
      onEsc = null;
    }
    if (el.el.parentNode) {
      el.el.parentNode.removeChild(el.el);
    }
    if (dimmer.el.parentNode) {
      dimmer.el.parentNode.removeChild(dimmer.el);
    }
  };

  dimmer.on('click.stop', () => remove());
  const contentEl = h('div', `${cssPrefix}-toast-content`);
  contentEl.el.textContent = content != null ? String(content) : '';
  el.children(
    h('div', `${cssPrefix}-toast-header`).children(
      new Icon('close').on('click.stop', () => remove()),
      title != null ? String(title) : '',
    ),
    contentEl,
  );
  document.body.appendChild(el.el);
  document.body.appendChild(dimmer.el);
  // set offset
  const { width, height } = el.box();
  const docEl = document.documentElement || {};
  const clientHeight = docEl.clientHeight || 0;
  const clientWidth = docEl.clientWidth || 0;
  el.offset({
    left: Math.max(0, (clientWidth - width) / 2),
    top: Math.max(0, (clientHeight - height) / 3),
  });
  if (typeof window !== 'undefined') {
    onEsc = (evt) => {
      if (evt.keyCode === 27) {
        remove();
      }
    };
    bind(window, 'keydown', onEsc);
  }
  activeToastRemovers.add(remove);
  return remove;
}

export default {};
