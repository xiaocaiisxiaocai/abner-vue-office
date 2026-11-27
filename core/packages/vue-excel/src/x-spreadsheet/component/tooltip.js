import { h } from './element';
import { bind, unbind } from './event';
import { cssPrefix } from '../config';

let activeCleanup = null;
let activeTarget = null;

export function hideTooltip(scopeEl = null) {
  if (typeof activeCleanup === 'function') {
    if (scopeEl && activeTarget && typeof scopeEl.contains === 'function' && !scopeEl.contains(activeTarget)) {
      return;
    }
    activeCleanup();
  }
}

export default function tooltip(html, target) {
  if (!target || typeof document === 'undefined' || !document.body) {
    return;
  }
  if (target.classList && target.classList.contains('active')) {
    return;
  }
  if (typeof target._xTooltipCleanup === 'function') {
    target._xTooltipCleanup();
  }
  hideTooltip();
  const {
    left, top, width, height,
  } = target.getBoundingClientRect();
  const scrollX = (typeof window !== 'undefined' && window.scrollX) || 0;
  const scrollY = (typeof window !== 'undefined' && window.scrollY) || 0;
  const el = h('div', `${cssPrefix}-tooltip`).show();
  el.el.textContent = html != null ? String(html) : '';
  document.body.appendChild(el.el);
  const elBox = el.box();
  el.css('left', `${left + scrollX + (width / 2) - (elBox.width / 2)}px`)
    .css('top', `${top + scrollY + height + 2}px`);

  const cleanup = () => {
    if (el.el.parentNode) {
      el.el.parentNode.removeChild(el.el);
    }
    unbind(target, 'mouseleave', cleanup);
    unbind(target, 'click', cleanup);
    if (target._xTooltipCleanup === cleanup) {
      target._xTooltipCleanup = null;
    }
    if (activeCleanup === cleanup) {
      activeCleanup = null;
      activeTarget = null;
    }
  };
  target._xTooltipCleanup = cleanup;
  activeCleanup = cleanup;
  activeTarget = target;

  bind(target, 'mouseleave', cleanup);
  bind(target, 'click', cleanup);
}
