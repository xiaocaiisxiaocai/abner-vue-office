export function bind(target, name, fn, options) {
  if (target && typeof target.addEventListener === 'function') {
    target.addEventListener(name, fn, options);
  }
}
export function unbind(target, name, fn, options) {
  if (target && typeof target.removeEventListener === 'function') {
    target.removeEventListener(name, fn, options);
  }
}
export function unbindClickoutside(el) {
  const dom = el && el.el ? el.el : el;
  if (dom && dom.xclickoutside) {
    if (typeof window !== 'undefined' && window.document) {
      unbind(window.document, 'click', dom.xclickoutside);
    }
    delete dom.xclickoutside;
  }
}

export function bindClickoutside(el, cb) {
  const dom = el && el.el ? el.el : el;
  if (!dom || typeof window === 'undefined' || !window.document) {
    return;
  }
  unbindClickoutside(el);
  dom.xclickoutside = (evt) => {
    const containsTarget = (el && typeof el.contains === 'function' && el.contains(evt.target))
      || (typeof dom.contains === 'function' && dom.contains(evt.target));
    if (evt.detail === 2 || containsTarget) return;
    if (cb) cb(el);
    else {
      if (el && typeof el.hide === 'function') {
        el.hide();
      }
      unbindClickoutside(el);
    }
  };
  bind(window.document, 'click', dom.xclickoutside);
}

export function mouseMoveUp(target, movefunc, upfunc, cancelfunc) {
  if (target && typeof target._xCancelMoveUp === 'function') {
    target._xCancelMoveUp();
  }
  const t = target;
  let active = true;
  const xEvtUp = (evt) => {
    if (!active) return;
    active = false;
    unbind(target, 'mousemove', movefunc);
    unbind(target, 'mouseup', xEvtUp);
    if (t && t._xCancelMoveUp === cancel) {
      t._xCancelMoveUp = null;
    }
    if (typeof upfunc === 'function') upfunc(evt);
  };
  const cancel = () => {
    if (!active) return;
    active = false;
    unbind(target, 'mousemove', movefunc);
    unbind(target, 'mouseup', xEvtUp);
    if (t && t._xCancelMoveUp === cancel) {
      t._xCancelMoveUp = null;
    }
    if (typeof cancelfunc === 'function') cancelfunc();
  };
  if (t) {
    t._xCancelMoveUp = cancel;
  }
  bind(target, 'mousemove', movefunc);
  bind(target, 'mouseup', xEvtUp);
  return cancel;
}

function calTouchDirection(spanx, spany, evt, cb) {
  let direction = '';
  if (Math.abs(spanx) > Math.abs(spany)) {
    direction = spanx > 0 ? 'right' : 'left';
    cb(direction, spanx, evt);
  } else {
    direction = spany > 0 ? 'down' : 'up';
    cb(direction, spany, evt);
  }
}

export function bindTouch(target, { move, end } = {}) {
  let startx = 0;
  let starty = 0;
  const onTouchStart = (evt) => {
    if (!evt.touches || !evt.touches[0]) return;
    const { pageX, pageY } = evt.touches[0];
    startx = pageX;
    starty = pageY;
  };
  const onTouchMove = (evt) => {
    if (!move || !evt.changedTouches || !evt.changedTouches[0]) return;
    const { pageX, pageY } = evt.changedTouches[0];
    const spanx = pageX - startx;
    const spany = pageY - starty;
    if (Math.abs(spanx) > 10 || Math.abs(spany) > 10) {
      calTouchDirection(spanx, spany, evt, move);
      startx = pageX;
      starty = pageY;
    }
    evt.preventDefault();
  };
  const onTouchEnd = (evt) => {
    if (!end || !evt.changedTouches || !evt.changedTouches[0]) return;
    const { pageX, pageY } = evt.changedTouches[0];
    const spanx = pageX - startx;
    const spany = pageY - starty;
    calTouchDirection(spanx, spany, evt, end);
  };
  bind(target, 'touchstart', onTouchStart, { passive: true });
  bind(target, 'touchmove', onTouchMove, { passive: false });
  bind(target, 'touchend', onTouchEnd);
  return () => {
    unbind(target, 'touchstart', onTouchStart, { passive: true });
    unbind(target, 'touchmove', onTouchMove, { passive: false });
    unbind(target, 'touchend', onTouchEnd);
  };
}

export function createEventEmitter() {
  const listeners = new Map();

  function on(eventName, callback) {
    const push = () => {
      const currentListener = listeners.get(eventName);
      return (Array.isArray(currentListener)
          && currentListener.push(callback))
          || false;
    };

    const create = () => listeners.set(eventName, [].concat(callback));

    return (listeners.has(eventName)
        && push())
        || create();
  }

  function fire(eventName, args = []) {
    const exec = () => {
      const currentListener = listeners.get(eventName);
      for (const callback of [...currentListener]) callback.call(null, ...args);
    };

    return listeners.has(eventName)
        && exec();
  }

  function removeListener(eventName, callback) {
    const remove = () => {
      const currentListener = listeners.get(eventName);
      const idx = currentListener.indexOf(callback);
      return (idx >= 0)
          && currentListener.splice(idx, 1)
          && listeners.get(eventName).length === 0
          && listeners.delete(eventName);
    };

    return listeners.has(eventName)
        && remove();
  }

  function once(eventName, callback) {
    const execCalllback = (...args) => {
      removeListener(eventName, execCalllback);
      callback.call(null, ...args);
    };

    return on(eventName, execCalllback);
  }

  function removeAllListeners() {
    listeners.clear();
  }

  return {
    get current() {
      return listeners;
    },
    on,
    once,
    fire,
    removeListener,
    removeAllListeners,
  };
}
