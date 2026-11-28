import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CORE_DIR = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);

export function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

export function createCanvasContextMock() {
    return {
        scale: () => {},
        rotate: () => {},
        translate: () => {},
        transform: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        closePath: () => {},
        rect: () => {},
        clip: () => {},
        fill: () => {},
        clearRect: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        fillText: () => {},
        strokeText: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        drawImage: () => {},
        setLineDash: () => {},
        measureText: s => ({ width: String(s ?? '').length * 8 })
    };
}

function setSubtreeConnected(node, connected) {
    if (!node || typeof node !== 'object') return;
    if ('isConnected' in node) {
        node.isConnected = connected;
    }
    if (Array.isArray(node.childNodes)) {
        node.childNodes.forEach(c => setSubtreeConnected(c, connected));
    }
}

export function createDomMocks() {
    class MockElement {
        constructor(tagName) {
            this.tagName = String(tagName || 'div').toUpperCase();
            this._className = '';
            this.children = [];
            this.childNodes = [];
            this.parentNode = null;
            this.attributes = new Map();
            this.listeners = new Map();
            this.style = {
                setProperty: (k, v) => {
                    this.style[k] = v;
                },
                removeProperty: (k) => {
                    delete this.style[k];
                }
            };
            this._innerHTML = '';
            this._textContent = '';
            this.scrollTop = 0;
            this.scrollLeft = 0;
            this.offsetTop = 0;
            this.offsetLeft = 0;
            this.offsetWidth = 800;
            this.offsetHeight = 600;
            this.clientWidth = 800;
            this.clientHeight = 600;
            this.width = 0;
            this.height = 0;
            this.readOnly = false;
            this.focused = false;
            this.value = '';
            this.selectionStart = 0;
            this.selectionEnd = 0;
            this.src = '';
            this.download = '';
            this.href = '';
            this.isConnected = false;
            this.classList = {
                add: (...tokens) => {
                    const set = new Set(this._className.split(/\s+/).filter(Boolean));
                    tokens.forEach(t => set.add(t));
                    this._className = Array.from(set).join(' ');
                },
                remove: (...tokens) => {
                    const rm = new Set(tokens);
                    this._className = this._className.split(/\s+/).filter(t => t && !rm.has(t)).join(' ');
                },
                contains: (token) => this._className.split(/\s+/).filter(Boolean).includes(token),
                toggle: (token) => {
                    if (this.classList.contains(token)) {
                        this.classList.remove(token);
                        return false;
                    }
                    this.classList.add(token);
                    return true;
                }
            };
        }

        get className() {
            return this._className;
        }

        set className(val) {
            this._className = String(val || '');
        }

        get innerHTML() {
            return this._innerHTML;
        }

        set innerHTML(val) {
            this._innerHTML = String(val);
            this.children.forEach(c => {
                c.parentNode = null;
                setSubtreeConnected(c, false);
            });
            this.children = [];
            this.childNodes = [];
        }

        get textContent() {
            if (this.childNodes.length > 0) {
                return this.childNodes.map(n => (n && typeof n.textContent === 'string' ? n.textContent : (n && typeof n.data === 'string' ? n.data : ''))).join('');
            }
            return this._textContent;
        }

        set textContent(val) {
            this._textContent = String(val ?? '');
            this._innerHTML = '';
            this.children.forEach(c => {
                c.parentNode = null;
                setSubtreeConnected(c, false);
            });
            this.children = [];
            this.childNodes = [];
        }

        get firstChild() {
            return this.childNodes[0] || null;
        }

        cloneNode(deep = false) {
            const copy = new MockElement(this.tagName);
            copy.className = this.className;
            copy.width = this.width;
            copy.height = this.height;
            copy.value = this.value;
            copy.src = this.src;
            copy.download = this.download;
            copy.href = this.href;
            copy._textContent = this._textContent;
            copy._innerHTML = this._innerHTML;
            copy.attributes = new Map(this.attributes);
            Object.keys(this.style).forEach((k) => {
                if (typeof this.style[k] !== 'function') {
                    copy.style[k] = this.style[k];
                }
            });
            copy.getContext = this.getContext;
            if (deep) {
                this.children.forEach(c => copy.appendChild(c.cloneNode(true)));
            }
            return copy;
        }

        appendChild(child) {
            if (child && child.parentNode && typeof child.parentNode.removeChild === 'function') {
                child.parentNode.removeChild(child);
            }
            if (child) {
                child.parentNode = this;
                this.childNodes.push(child);
                if (child.tagName) {
                    this.children.push(child);
                }
                if (this.isConnected) {
                    setSubtreeConnected(child, true);
                }
            }
            return child;
        }

        insertBefore(newNode, refNode) {
            if (newNode && newNode.parentNode && typeof newNode.parentNode.removeChild === 'function') {
                newNode.parentNode.removeChild(newNode);
            }
            const idx = this.childNodes.indexOf(refNode);
            if (idx === -1) {
                return this.appendChild(newNode);
            }
            newNode.parentNode = this;
            this.childNodes.splice(idx, 0, newNode);
            if (newNode.tagName) {
                const cIdx = this.children.indexOf(refNode);
                if (cIdx === -1) {
                    this.children.push(newNode);
                } else {
                    this.children.splice(cIdx, 0, newNode);
                }
            }
            if (this.isConnected) {
                setSubtreeConnected(newNode, true);
            }
            return newNode;
        }

        removeChild(child) {
            const idx = this.childNodes.indexOf(child);
            if (idx !== -1) {
                this.childNodes.splice(idx, 1);
            }
            const cIdx = this.children.indexOf(child);
            if (cIdx !== -1) {
                this.children.splice(cIdx, 1);
            }
            if (child) {
                child.parentNode = null;
                setSubtreeConnected(child, false);
            }
            return child;
        }

        append(...nodes) {
            nodes.forEach(n => this.appendChild(n));
        }

        setAttribute(k, v) {
            if (k === 'style' && typeof v === 'string') {
                this.attributes.set(k, v);
                return;
            }
            this.attributes.set(k, String(v));
        }

        getAttribute(k) {
            return this.attributes.has(k) ? this.attributes.get(k) : null;
        }

        removeAttribute(k) {
            this.attributes.delete(k);
        }

        addEventListener(type, fn) {
            if (!this.listeners.has(type)) {
                this.listeners.set(type, new Set());
            }
            this.listeners.get(type).add(fn);
        }

        removeEventListener(type, fn) {
            const set = this.listeners.get(type);
            if (set) {
                set.delete(fn);
            }
        }

        dispatchEvent(evt) {
            const eventObj = evt || {};
            if (!eventObj.target) {
                eventObj.target = this;
            }
            if (typeof eventObj.preventDefault !== 'function') {
                eventObj.preventDefault = () => {};
            }
            if (typeof eventObj.stopPropagation !== 'function') {
                eventObj.stopPropagation = () => {};
            }
            const set = this.listeners.get(eventObj.type);
            if (set) {
                Array.from(set).forEach(fn => fn(eventObj));
            }
        }

        getBoundingClientRect() {
            const parsePx = (v) => {
                if (typeof v === 'number' && Number.isFinite(v)) return v;
                if (typeof v === 'string') {
                    const m = v.trim().match(/^(-?\d+(?:\.\d+)?)px$/i);
                    if (m) return Number(m[1]);
                }
                return null;
            };
            const isHidden = this.style && this.style.display === 'none';
            const cssW = parsePx(this.style && this.style.width);
            const cssH = parsePx(this.style && this.style.height);
            const cssL = parsePx(this.style && this.style.left);
            const cssT = parsePx(this.style && this.style.top);
            const w = isHidden ? 0 : (cssW !== null ? cssW : this.clientWidth);
            const h = isHidden ? 0 : (cssH !== null ? cssH : this.clientHeight);
            const l = cssL !== null ? cssL : 0;
            const t = cssT !== null ? cssT : 0;
            return {
                width: w,
                height: h,
                top: t,
                left: l,
                right: l + w,
                bottom: t + h
            };
        }

        getContext() {
            return createCanvasContextMock();
        }

        querySelector(sel) {
            if (!sel || typeof sel !== 'string') return null;
            const idSel = sel.startsWith('#') ? sel.slice(1) : null;
            const cls = sel.startsWith('.') ? sel.slice(1) : null;
            for (const c of this.children) {
                if ((idSel && c.getAttribute('id') === idSel)
                    || (cls && c.className.split(/\s+/).includes(cls))
                    || (!idSel && !cls && c.tagName === sel.toUpperCase())) {
                    return c;
                }
                const found = c.querySelector(sel);
                if (found) {
                    return found;
                }
            }
            return null;
        }

        querySelectorAll(sel) {
            if (!sel || typeof sel !== 'string') return [];
            const idSel = sel.startsWith('#') ? sel.slice(1) : null;
            const cls = sel.startsWith('.') ? sel.slice(1) : null;
            const res = [];
            for (const c of this.children) {
                if ((idSel && c.getAttribute('id') === idSel)
                    || (cls && c.className.split(/\s+/).includes(cls))
                    || (!idSel && !cls && c.tagName === sel.toUpperCase())) {
                    res.push(c);
                }
                res.push(...c.querySelectorAll(sel));
            }
            return res;
        }

        contains(node) {
            if (node === this) {
                return true;
            }
            return this.children.some(c => c.contains(node));
        }

        click() {
            this.dispatchEvent({ type: 'click', button: 0, target: this });
            if (this.onClick) {
                this.onClick();
            }
        }

        focus() {
            this.focused = true;
        }

        setSelectionRange(start, end) {
            this.selectionStart = start;
            this.selectionEnd = end;
        }

        blur() {
            this.blurred = true;
        }
    }

    const body = new MockElement('body');
    const head = new MockElement('head');
    const documentElement = new MockElement('html');
    documentElement.isConnected = true;
    documentElement.appendChild(head);
    documentElement.appendChild(body);

    const docListeners = new Map();
    const mockDocument = {
        body,
        head,
        documentElement,
        activeElement: null,
        listeners: docListeners,
        addEventListener(type, fn) {
            if (!docListeners.has(type)) {
                docListeners.set(type, new Set());
            }
            docListeners.get(type).add(fn);
        },
        removeEventListener(type, fn) {
            const set = docListeners.get(type);
            if (set) {
                set.delete(fn);
            }
        },
        dispatchEvent(evt) {
            const set = docListeners.get(evt && evt.type);
            if (set) {
                Array.from(set).forEach(fn => fn(evt));
            }
        },
        createElement(tag) {
            return new MockElement(tag);
        },
        createTextNode(text) {
            return { nodeType: 3, textContent: String(text), parentNode: null };
        },
        querySelector(sel) {
            return documentElement.querySelector(sel);
        },
        querySelectorAll(sel) {
            return documentElement.querySelectorAll(sel);
        }
    };

    const windowListeners = new Map();
    const mockWindow = {
        document: mockDocument,
        devicePixelRatio: 1,
        scrollX: 0,
        scrollY: 0,
        innerWidth: 1024,
        navigator: { userAgent: 'Mozilla/5.0' },
        addEventListener(type, fn) {
            if (!windowListeners.has(type)) {
                windowListeners.set(type, new Set());
            }
            windowListeners.get(type).add(fn);
        },
        removeEventListener(type, fn) {
            const set = windowListeners.get(type);
            if (set) {
                set.delete(fn);
            }
        },
        getComputedStyle(el) {
            return {
                paddingTop: el && el.style && el.style.paddingTop ? el.style.paddingTop : '30px',
                marginLeft: el && el.style && el.style.marginLeft ? el.style.marginLeft : '0px',
                marginRight: el && el.style && el.style.marginRight ? el.style.marginRight : '0px'
            };
        },
        dispatchEvent(evt) {
            const set = windowListeners.get(evt && evt.type);
            if (set) {
                Array.from(set).forEach(fn => fn(evt));
            }
        }
    };

    return {
        MockElement,
        mockDocument,
        mockWindow,
        windowListeners
    };
}

export async function runWithDomGlobals(globals, fn) {
    const previous = new Map();
    for (const [key, value] of Object.entries(globals)) {
        previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, {
            value,
            configurable: true,
            writable: true,
            enumerable: true
        });
    }
    try {
        return await fn();
    } finally {
        for (const [key, desc] of previous.entries()) {
            if (desc) {
                Object.defineProperty(globalThis, key, desc);
            } else {
                delete globalThis[key];
            }
        }
    }
}

export function loadExcelModule() {
    const excelSrc = fs.readFileSync(path.join(CORE_DIR, 'packages/vue-excel/src/excel.js'), 'utf8')
        .replace('import * as Excel from \'exceljs/dist/exceljs\';', 'const Excel = require(\'exceljs\');')
        .replace(/import\s+tinycolor\s+from\s+'tinycolor2';/, 'const tinycolor = require(\'tinycolor2\');')
        .replace(/import\s+get\s+from\s+'lodash\/get';/, 'const get = require(\'lodash/get\');')
        .replace(/import\s+\{\s*getDarkColor,\s*getLightColor\s*\}\s+from\s+'\.\/color';/, 'const { getDarkColor, getLightColor } = colorMod;')
        .replace(/import\s+dayjs\s+from\s+'dayjs';/, 'const dayjs = require(\'dayjs\');')
        .replace(/import\s+utc\s+from\s+'dayjs\/plugin\/utc';/, 'const utc = require(\'dayjs/plugin/utc\');')
        .replace(/import\s+\{\s*read,\s*write\s*\}\s+from\s+'xlsx';/, 'const { read, write } = require(\'xlsx\');')
        .replace(/export\s+function\s+/g, 'function ');

    const colorSrc = fs.readFileSync(path.join(CORE_DIR, 'packages/vue-excel/src/color.js'), 'utf8')
        .replace(/export\s+function\s+/g, 'function ');

    const colorMod = new Function(`${colorSrc}\nreturn { getDarkColor, getLightColor };`)();
    const factory = new Function(
        'require',
        'colorMod',
        `${excelSrc}\nreturn { getData, readExcelData, transferExcelToSpreadSheet, getCellText, getCellTextWithMeta, getStyle, transferColumns, formatNumberValue, formatNumberWithMeta, splitNumFmtSections, formatExcelDate, formatExcelDateByNumFmt, formatElapsedDuration, transferArgbColor, transferThemeColor, extractWorkbookThemeColors };`
    );
    return factory(id => require(id), colorMod);
}

export function mountSfcScript(relPath, extraDeps = {}, initialProps = {}, refOverrides = {}, mountOpts = {}) {
    const raw = fs.readFileSync(path.join(CORE_DIR, relPath), 'utf8');
    const scriptMatch = raw.match(/<script>([\s\S]*?)<\/script>/);
    if (!scriptMatch) {
        throw new Error(`No <script> block in ${relPath}`);
    }
    const code = scriptMatch[1]
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
        .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
        .replace(/export\s+default\s+/g, 'const __sfcDef = ');

    const reactiveState = {};
    const props = { ...initialProps };
    const mountedHooks = [];
    const unmountHooks = [];
    const watchers = [];
    const emitted = [];
    let active = true;

    const resolveWatchSource = (source) => {
        if (typeof source === 'function') return source();
        if (Array.isArray(source)) return source.map(s => (typeof s === 'function' ? s() : s.value));
        if (source && typeof source === 'object' && 'value' in source) return source.value;
        return source;
    };

    const runWatchers = () => {
        if (!active) return;
        for (const w of watchers) {
            const next = resolveWatchSource(w.source);
            const changed = Array.isArray(next)
                ? next.some((v, idx) => !Array.isArray(w.prev) || v !== w.prev[idx])
                : next !== w.prev;
            if (changed) {
                const old = w.prev;
                w.prev = next;
                w.cb(next, old);
            }
        }
    };

    const makeRef = (init) => {
        let _val = init;
        return {
            get value() {
                return _val;
            },
            set value(next) {
                if (next !== _val) {
                    _val = next;
                    runWatchers();
                }
            }
        };
    };

    const vueDemiMock = {
        defineComponent: def => def,
        ref: makeRef,
        onMounted: fn => mountedHooks.push(fn),
        onBeforeUnmount: fn => unmountHooks.push(fn),
        watch: (source, cb, opts = {}) => {
            const entry = { source, cb, prev: resolveWatchSource(source) };
            watchers.push(entry);
            if (opts && opts.immediate) {
                cb(entry.prev, undefined);
            }
        },
        nextTick: fn => Promise.resolve().then(() => (typeof fn === 'function' ? fn() : undefined)),
        isVue2: Boolean(mountOpts.isVue2)
    };

    const depNames = Object.keys(extraDeps);
    const depVals = depNames.map(k => extraDeps[k]);
    const component = new Function(
        'defineComponent', 'ref', 'onMounted', 'onBeforeUnmount', 'watch', 'nextTick', 'isVue2',
        ...depNames,
        `${code}\nreturn __sfcDef;`
    )(
        vueDemiMock.defineComponent,
        vueDemiMock.ref,
        vueDemiMock.onMounted,
        vueDemiMock.onBeforeUnmount,
        vueDemiMock.watch,
        vueDemiMock.nextTick,
        vueDemiMock.isVue2,
        ...depVals
    );

    if (component && component.props) {
        for (const [k, def] of Object.entries(component.props)) {
            if (!(k in props) && def && 'default' in def) {
                props[k] = typeof def.default === 'function' ? def.default() : def.default;
            }
        }
    }

    for (const [k, v] of Object.entries(props)) {
        reactiveState[k] = v;
        Object.defineProperty(props, k, {
            enumerable: true,
            configurable: true,
            get: () => reactiveState[k],
            set: (next) => {
                reactiveState[k] = next;
            }
        });
    }

    const setupResult = component.setup(props, {
        emit: (name, ...args) => emitted.push({ name, args })
    });

    for (const [refKey, val] of Object.entries(refOverrides)) {
        if (setupResult[refKey] && typeof setupResult[refKey] === 'object' && 'value' in setupResult[refKey]) {
            setupResult[refKey].value = val;
        }
    }

    return {
        component,
        props,
        setupResult,
        emitted,
        mount() {
            mountedHooks.forEach(fn => fn());
        },
        unmount() {
            active = false;
            unmountHooks.forEach(fn => fn());
        },
        setProp(key, value) {
            reactiveState[key] = value;
            runWatchers();
        }
    };
}

export function mountScriptSetup(relPath, extraDeps = {}, initialProps = {}, returnNames = []) {
    const raw = fs.readFileSync(path.join(CORE_DIR, relPath), 'utf8');
    const scriptMatch = raw.match(/<script\s+setup>([\s\S]*?)<\/script>/);
    if (!scriptMatch) {
        throw new Error(`No <script setup> block in ${relPath}`);
    }
    const code = scriptMatch[1]
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
        .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
        .replace(/\bconst\s+props\s*=\s*defineProps\s*\([\s\S]*?\);/m, '')
        .replace(/\bdefineProps\s*\([\s\S]*?\);/m, '');

    const reactiveState = { ...initialProps };
    const props = {};
    for (const k of Object.keys(reactiveState)) {
        Object.defineProperty(props, k, {
            enumerable: true,
            configurable: true,
            get: () => reactiveState[k],
            set: (next) => {
                reactiveState[k] = next;
            }
        });
    }

    const mountedHooks = [];
    const unmountHooks = [];
    const watchers = [];
    let active = true;
    const resolveSource = (source) => {
        if (typeof source === 'function') return source();
        if (Array.isArray(source)) return source.map(s => (typeof s === 'function' ? s() : s.value));
        if (source && typeof source === 'object' && 'value' in source) return source.value;
        return source;
    };
    const triggerWatchers = () => {
        if (!active) return;
        for (const w of watchers) {
            const next = resolveSource(w.source);
            const changed = Array.isArray(next)
                ? next.some((v, idx) => !Array.isArray(w.prev) || v !== w.prev[idx])
                : next !== w.prev;
            if (changed) {
                const old = w.prev;
                w.prev = next;
                w.cb(next, old);
            }
        }
    };
    const makeRef = (init) => {
        let _val = init;
        return {
            get value() {
                return _val;
            },
            set value(next) {
                if (next !== _val) {
                    _val = next;
                    triggerWatchers();
                }
            }
        };
    };

    const depNames = Object.keys(extraDeps);
    const depVals = depNames.map(k => extraDeps[k]);
    const retObj = returnNames.length ? `{ ${returnNames.join(', ')} }` : '{}';
    const bindings = new Function(
        'props', 'ref', 'onMounted', 'onBeforeUnmount', 'watch',
        ...depNames,
        `${code}\nreturn ${retObj};`
    )(
        props,
        makeRef,
        fn => mountedHooks.push(fn),
        fn => unmountHooks.push(fn),
        (source, cb, opts = {}) => {
            const entry = { source, cb, prev: resolveSource(source) };
            watchers.push(entry);
            if (opts && opts.immediate) {
                cb(entry.prev, undefined);
            }
        },
        ...depVals
    );

    return {
        props,
        bindings,
        mount() {
            mountedHooks.forEach(fn => fn());
        },
        unmount() {
            active = false;
            unmountHooks.forEach(fn => fn());
        },
        setProp(key, value) {
            reactiveState[key] = value;
            triggerWatchers();
        },
        triggerWatchers
    };
}

export function loadStrippedModule(relPath, extraVars = {}) {
    let src = fs.readFileSync(path.join(CORE_DIR, relPath), 'utf8');
    const namedExports = [];
    src = src
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
        .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
        .replace(/export\s+default\s+/g, 'const __defaultExport = ')
        .replace(/export\s+class\s+([A-Za-z0-9_$]+)/g, (_m, name) => {
            namedExports.push(name);
            return `class ${name}`;
        })
        .replace(/export\s+function\s+([A-Za-z0-9_$]+)/g, (_m, name) => {
            namedExports.push(name);
            return `function ${name}`;
        })
        .replace(/export\s+const\s+([A-Za-z0-9_$]+)/g, (_m, name) => {
            namedExports.push(name);
            return `const ${name}`;
        })
        .replace(/export\s+let\s+([A-Za-z0-9_$]+)/g, (_m, name) => {
            namedExports.push(name);
            return `let ${name}`;
        })
        .replace(/export\s*\{([\s\S]*?)\};?/g, (_m, inner) => {
            inner.split(',').forEach((entry) => {
                const trimmed = entry.trim();
                if (!trimmed) {
                    return;
                }
                const asMatch = trimmed.match(/^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/);
                if (asMatch) {
                    namedExports.push(`${asMatch[2]}: ${asMatch[1]}`);
                } else {
                    namedExports.push(trimmed);
                }
            });
            return '';
        });

    const names = Object.keys(extraVars);
    const values = names.map(k => extraVars[k]);
    const namedLiteral = `{ ${namedExports.join(', ')} }`;
    const fn = new Function(
        ...names,
        `${src}\nconst __def = typeof __defaultExport !== 'undefined' ? __defaultExport : undefined;\nconst __named = ${namedLiteral};\nif (typeof __def === 'function') { return Object.assign(__def, __named); }\nif (__def && typeof __def === 'object') { return { ...__def, ...__named }; }\nreturn __named;`
    );
    return fn(...values);
}

export function runVmBundle(relPath, sandbox) {
    const code = fs.readFileSync(path.join(CORE_DIR, relPath), 'utf8');
    return vm.runInNewContext(code, sandbox, { filename: relPath });
}

export function loadXSpreadsheetStack() {
    const alphabetMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/alphabet.js');
    const { CellRange } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/cell_range.js', {
        expr2xy: alphabetMod.expr2xy,
        xy2expr: alphabetMod.xy2expr
    });
    const { Merges } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/merge.js', { CellRange });
    const helperMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/helper.js');
    const { Rows, shiftFormulaRefs } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/row.js', {
        helper: helperMod,
        expr2expr: alphabetMod.expr2expr,
        expr2xy: alphabetMod.expr2xy,
        stringAt: alphabetMod.stringAt
    });
    const { Cols } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/col.js', { helper: helperMod });
    const History = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/history.js');
    const Clipboard = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/clipboard.js');
    const Scroll = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/scroll.js');
    const CoreSelector = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/selector.js', { CellRange });
    const AutoFilter = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/auto_filter.js', { CellRange });
    const enLocale = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/en.js');
    const localeMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/locale.js', { en: enLocale });
    const { t, tf, locale } = localeMod;
    const Validator = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/validator.js', { t, helper: helperMod });
    const { Validations } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/validation.js', { Validator, CellRange });
    const fontMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/font.js');
    const formatMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/format.js', { tf });
    const { formulas, formulam, baseFormulas } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/formula.js', { tf, numberCalc: helperMod.numberCalc });
    const cellMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/cell.js', {
        expr2xy: alphabetMod.expr2xy,
        xy2expr: alphabetMod.xy2expr,
        numberCalc: helperMod.numberCalc
    });
    const autoFitMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/autofit.js', {
        stringAt: alphabetMod.stringAt,
        getFontSizePxByPt: fontMod.getFontSizePxByPt,
        _cell: cellMod,
        formulam,
        formatm: formatMod.formatm
    });
    const DataProxy = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/data_proxy.js', {
        Selector: CoreSelector,
        Scroll,
        History,
        Clipboard,
        AutoFilter,
        Merges,
        helper: helperMod,
        Rows,
        shiftFormulaRefs,
        Cols,
        Validations,
        CellRange,
        expr2xy: alphabetMod.expr2xy,
        xy2expr: alphabetMod.xy2expr,
        t,
        computeAutoFitCols: autoFitMod.computeAutoFitCols,
        computeAutoFitRows: autoFitMod.computeAutoFitRows
    });

    const eventMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/event.js');
    const { Element, h } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/element.js');
    const Icon = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/icon.js', { Element, h, cssPrefix: 'x-spreadsheet' });
    const Button = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/button.js', { Element, cssPrefix: 'x-spreadsheet', t });
    const tooltipMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/tooltip.js', { h, bind: eventMod.bind, unbind: eventMod.unbind, cssPrefix: 'x-spreadsheet' });
    const messageMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/message.js', { h, Icon, bind: eventMod.bind, unbind: eventMod.unbind, cssPrefix: 'x-spreadsheet' });
    const Dropdown = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown.js', {
        Element, h, bindClickoutside: eventMod.bindClickoutside, unbindClickoutside: eventMod.unbindClickoutside, cssPrefix: 'x-spreadsheet'
    });
    const ColorPalette = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/color_palette.js', { h, cssPrefix: 'x-spreadsheet' });
    const DropdownColor = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_color.js', { Dropdown, ColorPalette, Icon });
    const DropdownAlign = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_align.js', { Dropdown, h, Icon, cssPrefix: 'x-spreadsheet' });
    const DropdownFont = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_font.js', { Dropdown, h, baseFonts: fontMod.baseFonts, cssPrefix: 'x-spreadsheet' });
    const DropdownFontSize = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_fontsize.js', { Dropdown, h, fontSizes: fontMod.fontSizes, cssPrefix: 'x-spreadsheet' });
    const DropdownFormat = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_format.js', { Dropdown, h, baseFormats: formatMod.baseFormats, cssPrefix: 'x-spreadsheet' });
    const DropdownFormula = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_formula.js', { Dropdown, h, Icon, baseFormulas: formulas, cssPrefix: 'x-spreadsheet' });
    const DropdownLineType = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_linetype.js', { Dropdown, h, Icon, cssPrefix: 'x-spreadsheet' });
    const BorderPalette = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/border_palette.js', { h, Icon, DropdownColor, DropdownLineType, cssPrefix: 'x-spreadsheet' });
    const DropdownBorder = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_border.js', { Dropdown, Icon, BorderPalette });
    const ContextMenu = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/contextmenu.js', {
        h, bindClickoutside: eventMod.bindClickoutside, unbindClickoutside: eventMod.unbindClickoutside, cssPrefix: 'x-spreadsheet', tf
    });
    const Scrollbar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/scrollbar.js', { h, cssPrefix: 'x-spreadsheet' });

    const Item = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/item.js', { cssPrefix: 'x-spreadsheet', tooltip: tooltipMod, h, t });
    const IconItem = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/icon_item.js', { Item, Icon });
    const ToggleItem = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/toggle_item.js', { Item, Icon });
    const DropdownItem = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/dropdown_item.js', { Dropdown, Item });
    const toolbarItems = {
        Align: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/align.js', { DropdownItem, DropdownAlign }),
        Valign: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/valign.js', { DropdownItem, DropdownAlign }),
        Autofilter: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/autofilter.js', { ToggleItem }),
        Bold: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/bold.js', { ToggleItem }),
        Italic: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/italic.js', { ToggleItem }),
        Strike: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/strike.js', { ToggleItem }),
        Underline: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/underline.js', { ToggleItem }),
        Border: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/border.js', { DropdownItem, DropdownBorder }),
        Clearformat: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/clearformat.js', { IconItem }),
        Paintformat: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/paintformat.js', { ToggleItem }),
        TextColor: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/text_color.js', { DropdownItem, DropdownColor }),
        FillColor: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/fill_color.js', { DropdownItem, DropdownColor }),
        FontSize: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/font_size.js', { DropdownItem, DropdownFontSize, DropdownFontsize: DropdownFontSize }),
        Font: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/font.js', { DropdownItem, DropdownFont }),
        Format: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/format.js', { DropdownItem, DropdownFormat }),
        Formula: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/formula.js', { DropdownItem, DropdownFormula }),
        Freeze: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/freeze.js', { ToggleItem }),
        Merge: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/merge.js', { ToggleItem }),
        Redo: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/redo.js', { IconItem }),
        Undo: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/undo.js', { IconItem }),
        Print: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/print.js', { IconItem }),
        Textwrap: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/textwrap.js', { ToggleItem }),
        More: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/more.js', { Dropdown, DropdownItem, cssPrefix: 'x-spreadsheet', h, Icon })
    };
    const Toolbar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/index.js', {
        ...toolbarItems,
        Item, h, cssPrefix: 'x-spreadsheet', bind: eventMod.bind, unbind: eventMod.unbind, hideTooltip: tooltipMod.hideTooltip
    });

    const Suggest = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/suggest.js', {
        h, bindClickoutside: eventMod.bindClickoutside, unbindClickoutside: eventMod.unbindClickoutside, cssPrefix: 'x-spreadsheet'
    });
    const Calendar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/calendar.js', { h, Icon, t, cssPrefix: 'x-spreadsheet' });
    const Datepicker = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/datepicker.js', { Calendar, h, cssPrefix: 'x-spreadsheet' });
    const Editor = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/editor.js', { h, Suggest, Datepicker, cssPrefix: 'x-spreadsheet' });
    const FormInput = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/form_input.js', { h, cssPrefix: 'x-spreadsheet' });
    const FormSelect = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/form_select.js', { h, Suggest, cssPrefix: 'x-spreadsheet' });
    const FormField = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/form_field.js', { h, cssPrefix: 'x-spreadsheet', t });
    const Modal = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/modal.js', { h, Icon, cssPrefix: 'x-spreadsheet', bind: eventMod.bind, unbind: eventMod.unbind });
    const ModalValidation = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/modal_validation.js', { Modal, FormInput, FormSelect, FormField, Button, t, h, cssPrefix: 'x-spreadsheet' });
    const SortFilter = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/sort_filter.js', {
        h, Button, bindClickoutside: eventMod.bindClickoutside, unbindClickoutside: eventMod.unbindClickoutside, cssPrefix: 'x-spreadsheet', t
    });
    const Resizer = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/resizer.js', { h, mouseMoveUp: eventMod.mouseMoveUp, cssPrefix: 'x-spreadsheet' });
    const Selector = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/selector.js', { h, cssPrefix: 'x-spreadsheet', CellRange });
    const drawMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/canvas/draw.js');
    const draw2Mod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/canvas/draw2.js');
    const Table = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/table.js', {
        stringAt: alphabetMod.stringAt,
        getFontSizePxByPt: fontMod.getFontSizePxByPt,
        _cell: cellMod,
        formulam,
        formatm: formatMod.formatm,
        Draw: drawMod.Draw,
        DrawBox: drawMod.DrawBox,
        thinLineWidth: drawMod.thinLineWidth,
        npx: drawMod.npx
    });
    const Print = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/print.js', {
        h, cssPrefix: 'x-spreadsheet', Button, Draw: drawMod.Draw, npx: drawMod.npx, renderCell: Table.renderCell, t
    });
    const Bottombar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/bottombar.js', {
        h, bindClickoutside: eventMod.bindClickoutside, unbindClickoutside: eventMod.unbindClickoutside, cssPrefix: 'x-spreadsheet', Icon, FormInput, Dropdown, tf
    });
    const Sheet = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/sheet.js', {
        h, bind: eventMod.bind, unbind: eventMod.unbind, mouseMoveUp: eventMod.mouseMoveUp, bindTouch: eventMod.bindTouch, createEventEmitter: eventMod.createEventEmitter,
        Resizer, Scrollbar, Selector, Editor, Print, ContextMenu, Table, Toolbar, ModalValidation, SortFilter, xtoast: messageMod.xtoast, cssPrefix: 'x-spreadsheet', formulas
    });
    const Spreadsheet = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/index.js', {
        h, DataProxy, Sheet, Bottombar, cssPrefix: 'x-spreadsheet', locale
    });

    return {
        alphabetMod, CellRange, Merges, helperMod, Rows, shiftFormulaRefs, Cols, History, Clipboard, Scroll, CoreSelector,
        AutoFilter, enLocale, localeMod, t, tf, locale, Validator, Validations, fontMod, formatMod, formulas, formulam, baseFormulas,
        cellMod, autoFitMod, DataProxy, eventMod, Element, h, Icon, Button, tooltipMod, messageMod, Dropdown, ColorPalette, DropdownColor,
        DropdownAlign, DropdownFont, DropdownFontSize, DropdownFormat, DropdownFormula, DropdownLineType, BorderPalette,
        DropdownBorder, ContextMenu, Scrollbar, Item, IconItem, ToggleItem, DropdownItem, toolbarItems, Toolbar, Suggest,
        Calendar, Datepicker, Editor, FormInput, FormSelect, FormField, Modal, ModalValidation, SortFilter, Resizer, Selector,
        drawMod, draw2Mod, Table, Print, Bottombar, Sheet, Spreadsheet,
        spreadsheet: Spreadsheet.spreadsheet
    };
}
