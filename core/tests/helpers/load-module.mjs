import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CORE_DIR = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);

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
            this.selectionEnd = 0;
            this.src = '';
            this.download = '';
            this.href = '';
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
            if (!val) {
                this.children.forEach(c => {
                    c.parentNode = null;
                });
                this.children = [];
                this.childNodes = [];
            }
        }

        get textContent() {
            return this._textContent;
        }

        set textContent(val) {
            this._textContent = String(val ?? '');
            if (!val) {
                this._innerHTML = '';
                this.children.forEach(c => {
                    c.parentNode = null;
                });
                this.children = [];
                this.childNodes = [];
            }
        }

        get firstChild() {
            return this.childNodes[0] || null;
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
            return {
                width: this.clientWidth,
                height: this.clientHeight,
                top: 0,
                left: 0,
                right: this.clientWidth,
                bottom: this.clientHeight
            };
        }

        getContext() {
            return {
                clearRect: () => {},
                drawImage: () => {}
            };
        }

        querySelector(sel) {
            const cls = sel.startsWith('.') ? sel.slice(1) : null;
            for (const c of this.children) {
                if ((cls && c.className.split(/\s+/).includes(cls)) || c.tagName === sel.toUpperCase()) {
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
            const res = [];
            for (const c of this.children) {
                if (c.tagName === sel.toUpperCase()) {
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
            if (this.onClick) {
                this.onClick();
            }
        }

        focus() {
            this.focused = true;
            if (this.parentNode) {
                // no-op
            }
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
    documentElement.appendChild(head);
    documentElement.appendChild(body);

    const mockDocument = {
        body,
        head,
        documentElement,
        activeElement: null,
        createElement(tag) {
            return new MockElement(tag);
        },
        createTextNode(text) {
            return { nodeType: 3, textContent: String(text), parentNode: null };
        },
        querySelector() {
            return null;
        }
    };

    const windowListeners = new Map();
    const mockWindow = {
        document: mockDocument,
        devicePixelRatio: 1,
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
                marginLeft: '0px',
                marginRight: '0px'
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
        .replace(/import\s+cloneDeep\s+from\s+'lodash\/cloneDeep';/, 'const cloneDeep = require(\'lodash/cloneDeep\');')
        .replace(/import\s+get\s+from\s+'lodash\/get';/, 'const get = require(\'lodash/get\');')
        .replace(/import\s+\{\s*getDarkColor,\s*getLightColor\s*\}\s+from\s+'\.\/color';/, 'const { getDarkColor, getLightColor } = colorMod;')
        .replace(/import\s+dayjs\s+from\s+'dayjs';/, 'const dayjs = require(\'dayjs\');')
        .replace(/import\s+\{\s*read,\s*write\s*\}\s+from\s+'xlsx';/, 'const { read, write } = require(\'xlsx\');')
        .replace(/export\s+function\s+/g, 'function ');

    const colorSrc = fs.readFileSync(path.join(CORE_DIR, 'packages/vue-excel/src/color.js'), 'utf8')
        .replace(/export\s+function\s+/g, 'function ');

    const colorMod = new Function(`${colorSrc}\nreturn { getDarkColor, getLightColor };`)();
    const factory = new Function(
        'require',
        'colorMod',
        `${excelSrc}\nreturn { getData, readExcelData, transferExcelToSpreadSheet, getCellText, getStyle, transferColumns, formatNumberValue, splitNumFmtSections, formatExcelDate, formatExcelDateByNumFmt, transferArgbColor, transferThemeColor };`
    );
    return factory(id => require(id), colorMod);
}

export function mountSfcScript(relPath, extraDeps = {}, initialProps = {}, refOverrides = {}) {
    const raw = fs.readFileSync(path.join(CORE_DIR, relPath), 'utf8');
    const scriptMatch = raw.match(/<script>([\s\S]*?)<\/script>/);
    if (!scriptMatch) {
        throw new Error(`No <script> block in ${relPath}`);
    }
    let code = scriptMatch[1]
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
        .replace(/^\s*import\s+['"][^'"]+['"];\s*$/gm, '')
        .replace(/export\s+default\s+/g, 'const __sfcDef = ');

    const reactiveState = {};
    const props = { ...initialProps };
    const refs = new Map();
    const mountedHooks = [];
    const unmountHooks = [];
    const watchers = [];
    const emitted = [];

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

    const vueDemiMock = {
        defineComponent: def => def,
        ref: (init) => {
            const box = { value: init };
            refs.set(box, init);
            return box;
        },
        onMounted: fn => mountedHooks.push(fn),
        onBeforeUnmount: fn => unmountHooks.push(fn),
        watch: (getter, cb) => watchers.push({ getter, cb, prev: getter() }),
        nextTick: fn => Promise.resolve().then(() => (typeof fn === 'function' ? fn() : undefined)),
        isVue2: false
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
            unmountHooks.forEach(fn => fn());
        },
        setProp(key, value) {
            reactiveState[key] = value;
            for (const w of watchers) {
                const next = w.getter();
                const changed = Array.isArray(next)
                    ? next.some((v, idx) => !Array.isArray(w.prev) || v !== w.prev[idx])
                    : next !== w.prev;
                if (changed) {
                    const old = w.prev;
                    w.prev = next;
                    w.cb(next, old);
                }
            }
        }
    };
}

export function loadStrippedModule(relPath, extraVars = {}) {
    let src = fs.readFileSync(path.join(CORE_DIR, relPath), 'utf8');
    const namedExports = [];
    src = src
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
        .replace(/^\s*import\s+['"][^'"]+['"];\s*$/gm, '')
        .replace(/export\s+default\s+/g, 'const __defaultExport = ')
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
