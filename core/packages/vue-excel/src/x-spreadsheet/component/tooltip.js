import { h } from './element';
import { bind, unbind } from './event';
import { cssPrefix } from '../config';

export default function tooltip(html, target) {
  if (target.classList.contains('active')) {
    return;
  }
  if (typeof target._xTooltipCleanup === 'function') {
    target._xTooltipCleanup();
  }
  const {
    left, top, width, height,
  } = target.getBoundingClientRect();
  const el = h('div', `${cssPrefix}-tooltip`).html(html).show();
  document.body.appendChild(el.el);
  const elBox = el.box();
  // console.log('elBox:', elBox);
  el.css('left', `${left + (width / 2) - (elBox.width / 2)}px`)
    .css('top', `${top + height + 2}px`);

  const cleanup = () => {
    if (el.el.parentNode) {
      el.el.parentNode.removeChild(el.el);
    }
    unbind(target, 'mouseleave', cleanup);
    unbind(target, 'click', cleanup);
    if (target._xTooltipCleanup === cleanup) {
      target._xTooltipCleanup = null;
    }
  };
  target._xTooltipCleanup = cleanup;

  bind(target, 'mouseleave', cleanup);
  bind(target, 'click', cleanup);
}
