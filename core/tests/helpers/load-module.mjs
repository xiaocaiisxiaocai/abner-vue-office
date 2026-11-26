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
            this.className = '';
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
            this.scrollTop = 0;
            this.scrollLeft = 0;
            this.clientWidth = 800;
            this.clientHeight = 600;
            this.width = 0;
            this.height = 0;
            this.readOnly = false;
            this.value = '';
            this.src = '';
            this.download = '';
            this.href = '';
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
                paddingTop: el && el.style && el.style.paddingTop ? el.style.paddingTop : '30px'
            };
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
        `${excelSrc}\nreturn { getData, readExcelData, transferExcelToSpreadSheet, getCellText, getStyle, transferColumns, formatNumberValue, splitNumFmtSections };`
    );
    return factory(id => require(id), colorMod);
}

export function loadStrippedModule(relPath, extraVars = {}) {
    let src = fs.readFileSync(path.join(CORE_DIR, relPath), 'utf8');
    src = src
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
        .replace(/^\s*import\s+['"][^'"]+['"];\s*$/gm, '')
        .replace(/export\s+default\s+/g, 'const __defaultExport = ')
        .replace(/export\s+function\s+/g, 'function ')
        .replace(/export\s+const\s+/g, 'const ')
        .replace(/export\s+let\s+/g, 'let ')
        .replace(/export\s*\{[\s\S]*?\};?/g, '');

    const names = Object.keys(extraVars);
    const values = names.map(k => extraVars[k]);
    const fn = new Function(...names, `${src}\nreturn typeof __defaultExport !== 'undefined' ? __defaultExport : {};`);
    return fn(...values);
}

export function runVmBundle(relPath, sandbox) {
    const code = fs.readFileSync(path.join(CORE_DIR, relPath), 'utf8');
    return vm.runInNewContext(code, sandbox, { filename: relPath });
}
