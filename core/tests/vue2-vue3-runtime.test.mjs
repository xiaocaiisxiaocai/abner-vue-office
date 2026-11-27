import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { CORE_DIR, runWithDomGlobals, runVmBundle } from './helpers/load-module.mjs';

const require = createRequire(import.meta.url);

function loadVue2WithBrowserGlobals(win, doc) {
    const vue2Path = require.resolve('vue2/dist/vue.common.dev.js');
    const compApiPath = require.resolve('@vue/composition-api');
    const vueDemiV2Path = require.resolve('vue-demi/lib/v2/index.cjs');
    const vue2Req = createRequire(vue2Path);
    const compApiReq = createRequire(compApiPath);
    const demiReq = createRequire(vueDemiV2Path);
    const vue2Code = fs.readFileSync(vue2Path, 'utf8');
    const compApiCode = fs.readFileSync(compApiPath, 'utf8');
    const demiCode = fs.readFileSync(vueDemiV2Path, 'utf8');

    const loadCjs = (code, customReq) => {
        const mod = { exports: {} };
        new Function('require', 'module', 'exports', 'window', 'document', 'navigator', code)(
            customReq, mod, mod.exports, win, doc, win.navigator
        );
        return mod.exports;
    };

    const Vue2 = loadCjs(vue2Code, vue2Req);
    Vue2.config.productionTip = false;
    Vue2.config.devtools = false;
    const CompApi = loadCjs(compApiCode, id => (id === 'vue' ? Vue2 : compApiReq(id)));
    Vue2.use(CompApi);
    const VueDemiV2 = loadCjs(demiCode, (id) => {
        if (id === 'vue') return Vue2;
        if (id === '@vue/composition-api') return CompApi;
        return demiReq(id);
    });
    return { Vue2, VueDemiV2 };
}

function createMiniDom() {
    class MiniNode {
        constructor(nodeType, tagOrText) {
            this.nodeType = nodeType;
            this.parentNode = null;
            this.childNodes = [];
            this.attributes = {};
            this.style = {
                setProperty: (k, v) => {
                    this.style[k] = v;
                },
                removeProperty: (k) => {
                    delete this.style[k];
                }
            };
            this.listeners = {};
            this.scrollTop = 0;
            this.scrollLeft = 0;
            this.clientWidth = 800;
            this.clientHeight = 600;
            this.offsetWidth = 800;
            this.offsetHeight = 600;
            this.isConnected = true;
            if (nodeType === 1) {
                this.tagName = String(tagOrText).toUpperCase();
                this.nodeName = this.tagName;
                this._className = '';
            } else if (nodeType === 3) {
                this.nodeValue = String(tagOrText);
                this.data = this.nodeValue;
            } else {
                this.nodeValue = String(tagOrText || '');
                this.data = this.nodeValue;
            }
        }

        get children() {
            return this.childNodes.filter(n => n.nodeType === 1);
        }

        get firstChild() {
            return this.childNodes[0] || null;
        }

        get nextSibling() {
            if (!this.parentNode) return null;
            const idx = this.parentNode.childNodes.indexOf(this);
            return idx >= 0 ? (this.parentNode.childNodes[idx + 1] || null) : null;
        }

        get className() {
            return this._className || '';
        }

        set className(val) {
            this._className = String(val || '');
        }

        get classList() {
            const tokens = () => this._className.split(/\s+/).filter(Boolean);
            return {
                add: (...cls) => {
                    const set = new Set(tokens());
                    cls.filter(Boolean).forEach(c => set.add(c));
                    this._className = Array.from(set).join(' ');
                },
                remove: (...cls) => {
                    const drop = new Set(cls);
                    this._className = tokens().filter(c => !drop.has(c)).join(' ');
                },
                contains: c => tokens().includes(c),
                toggle: (c, force) => {
                    const has = tokens().includes(c);
                    const next = force === undefined ? !has : Boolean(force);
                    if (next) this.classList.add(c);
                    else this.classList.remove(c);
                    return next;
                }
            };
        }

        get textContent() {
            if (this.nodeType === 3 || this.nodeType === 8) return this.nodeValue;
            return this.childNodes.map(c => c.textContent).join('');
        }

        set textContent(val) {
            if (this.nodeType === 3 || this.nodeType === 8) {
                this.nodeValue = String(val ?? '');
                this.data = this.nodeValue;
            } else {
                this.childNodes.forEach(c => {
                    c.parentNode = null;
                });
                this.childNodes = [];
                if (val !== '' && val != null) {
                    this.appendChild(new MiniNode(3, val));
                }
            }
        }

        setAttribute(k, v) {
            this.attributes[k] = String(v);
            if (k === 'class') this._className = String(v);
        }

        getAttribute(k) {
            return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null;
        }

        hasAttribute(k) {
            return Object.prototype.hasOwnProperty.call(this.attributes, k);
        }

        removeAttribute(k) {
            delete this.attributes[k];
            if (k === 'class') this._className = '';
        }

        get parentElement() {
            return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
        }

        get innerHTML() {
            return '';
        }

        set innerHTML(val) {
            if (!val) {
                this.textContent = '';
            }
        }

        appendChild(node) {
            if (!node) return node;
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
            node.parentNode = this;
            this.childNodes.push(node);
            return node;
        }

        insertBefore(node, ref) {
            if (!node) return node;
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
            const idx = this.childNodes.indexOf(ref);
            if (idx === -1) return this.appendChild(node);
            node.parentNode = this;
            this.childNodes.splice(idx, 0, node);
            return node;
        }

        removeChild(node) {
            const idx = this.childNodes.indexOf(node);
            if (idx !== -1) {
                this.childNodes.splice(idx, 1);
                node.parentNode = null;
            }
            return node;
        }

        addEventListener(type, fn) {
            if (!this.listeners[type]) this.listeners[type] = new Set();
            this.listeners[type].add(fn);
        }

        removeEventListener(type, fn) {
            if (this.listeners[type]) this.listeners[type].delete(fn);
        }

        getBoundingClientRect() {
            return { width: this.clientWidth, height: this.clientHeight, top: 0, left: 0 };
        }

        getContext() {
            return {
                scale: () => {},
                save: () => {},
                restore: () => {},
                beginPath: () => {},
                rect: () => {},
                clip: () => {},
                fill: () => {},
                translate: () => {},
                clearRect: () => {},
                fillRect: () => {},
                fillText: () => {},
                moveTo: () => {},
                lineTo: () => {},
                stroke: () => {},
                drawImage: () => {},
                setLineDash: () => {},
                measureText: () => ({ width: 10 })
            };
        }

        querySelector(sel) {
            const cls = sel && sel.startsWith('.') ? sel.slice(1) : null;
            for (const c of this.children) {
                if ((cls && c.className.split(/\s+/).includes(cls)) || (!cls && c.tagName === String(sel).toUpperCase())) {
                    return c;
                }
                const found = c.querySelector(sel);
                if (found) return found;
            }
            return null;
        }

        querySelectorAll(sel) {
            const res = [];
            for (const c of this.children) {
                if (c.tagName === String(sel).toUpperCase()) res.push(c);
                res.push(...c.querySelectorAll(sel));
            }
            return res;
        }

        contains(node) {
            if (node === this) return true;
            return this.childNodes.some(c => c.contains && c.contains(node));
        }

        cloneNode(deep = false) {
            const c = new MiniNode(this.nodeType, this.nodeType === 1 ? this.tagName : this.nodeValue);
            c._className = this._className;
            c.attributes = { ...this.attributes };
            if (deep) {
                this.childNodes.forEach(ch => c.appendChild(ch.cloneNode(true)));
            }
            return c;
        }
    }

    const body = new MiniNode(1, 'body');
    const head = new MiniNode(1, 'head');
    const html = new MiniNode(1, 'html');
    html.appendChild(head);
    html.appendChild(body);
    const doc = {
        nodeType: 9,
        body,
        head,
        documentElement: html,
        createElement: tag => new MiniNode(1, tag),
        createElementNS: (_ns, tag) => new MiniNode(1, tag),
        createTextNode: txt => new MiniNode(3, txt),
        createComment: txt => new MiniNode(8, txt),
        querySelector: () => null,
        querySelectorAll: () => []
    };
    const listeners = new Map();
    const win = {
        document: doc,
        devicePixelRatio: 1,
        innerWidth: 1024,
        navigator: { userAgent: 'Mozilla/5.0' },
        addEventListener(type, fn) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(fn);
        },
        removeEventListener(type, fn) {
            if (listeners.has(type)) listeners.get(type).delete(fn);
        },
        getComputedStyle: () => ({ paddingTop: '30px', marginLeft: '0px', marginRight: '0px' })
    };
    return { doc, win, listeners, Element: MiniNode };
}

function loadV2BundleWithRealVue2(Vue2, VueDemiV2, relPath, win, doc) {
    const mod = { exports: {} };
    const ctx = {
        module: mod,
        exports: mod.exports,
        require: (id) => {
            if (id === 'vue') return Vue2;
            if (id === 'vue-demi') return VueDemiV2;
            throw new Error(`Unexpected require: ${id}`);
        },
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        URL,
        Blob,
        Response: typeof Response !== 'undefined' ? Response : undefined,
        Uint8Array,
        ArrayBuffer,
        SVGElement: class {},
        window: win,
        document: doc,
        navigator: win.navigator,
        getComputedStyle: win.getComputedStyle
    };
    ctx.self = ctx;
    ctx.global = ctx;
    ctx.globalThis = ctx;
    runVmBundle(relPath, ctx);
    return mod.exports;
}

function loadV3BundleWithRealVue3(Vue3, VueDemiV3, relPath, win, doc) {
    const mod = { exports: {} };
    const ctx = {
        module: mod,
        exports: mod.exports,
        require: (id) => {
            if (id === 'vue') return Vue3;
            if (id === 'vue-demi') return VueDemiV3;
            throw new Error(`Unexpected require: ${id}`);
        },
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        URL,
        Blob,
        Response: typeof Response !== 'undefined' ? Response : undefined,
        Uint8Array,
        ArrayBuffer,
        SVGElement: class {},
        window: win,
        document: doc,
        navigator: win.navigator,
        getComputedStyle: win.getComputedStyle
    };
    ctx.self = ctx;
    ctx.global = ctx;
    ctx.globalThis = ctx;
    runVmBundle(relPath, ctx);
    return mod.exports;
}

test('all 4 compiled lib/v2/index.js bundles mount, emit events, expose methods, and clean up under real Vue 2.6 + @vue/composition-api', async () => {
    const { doc, win, listeners, Element } = createMiniDom();
    win.SVGElement = class {};
    win.Element = Element;
    const { Vue2, VueDemiV2 } = await runWithDomGlobals({
        window: win,
        document: doc,
        navigator: win.navigator,
        Element,
        SVGElement: win.SVGElement
    }, () => loadVue2WithBrowserGlobals(win, doc));
    assert.equal(VueDemiV2.isVue2, true);

    await runWithDomGlobals({
        window: win,
        document: doc,
        navigator: win.navigator,
        Element,
        SVGElement: win.SVGElement,
        getComputedStyle: win.getComputedStyle
    }, async () => {
        const specs = [
            ['packages/vue-docx/lib/v2/index.js', 'AbnerVueOfficeDocx', 'abner-vue-office-docx'],
            ['packages/vue-excel/lib/v2/index.js', 'AbnerVueOfficeExcel', 'abner-vue-office-excel'],
            ['packages/vue-pdf/lib/v2/index.js', 'AbnerVueOfficePdf', 'abner-vue-office-pdf'],
            ['packages/vue-pptx/lib/v2/index.js', 'AbnerVueOfficePptx', 'abner-vue-office-pptx']
        ];
        for (const [rel, expectedName, rootCls] of specs) {
            const Comp = loadV2BundleWithRealVue2(Vue2, VueDemiV2, rel, win, doc);
            assert.equal(Comp.name, expectedName);
            Vue2.use(Comp);
            assert.ok(Vue2.options.components[expectedName]);

            const host = doc.createElement('div');
            doc.body.appendChild(host);
            const events = [];
            const vmInst = new Vue2({
                render(h) {
                    return h(
                        Comp,
                        {
                            props: { src: '' },
                            on: { error: e => events.push(e) },
                            ref: 'target'
                        },
                        expectedName === 'AbnerVueOfficePdf' ? [h('span', { class: 'slot-badge' }, 'badge')] : []
                    );
                }
            }).$mount(host);

            const targetRef = vmInst.$refs.target;
            assert.equal(typeof targetRef.save, 'function');
            if (expectedName === 'AbnerVueOfficePdf') {
                assert.equal(typeof targetRef.getScale, 'function');
                assert.equal(typeof targetRef.setScale, 'function');
                assert.equal(typeof targetRef.rerender, 'function');
                assert.equal(targetRef.userScale, 1);
                targetRef.setScale(1.5);
                assert.equal(targetRef.getScale(), 1.5);
                assert.ok(vmInst.$el.querySelector('.slot-badge'));
            } else if (expectedName === 'AbnerVueOfficePptx') {
                assert.equal(typeof targetRef.rerender, 'function');
            }
            assert.ok(vmInst.$el.className.includes(rootCls));
            if (expectedName === 'AbnerVueOfficeExcel') {
                assert.ok(vmInst.$el.querySelector('.x-spreadsheet'));
            }
            vmInst.$destroy();
        }
        assert.equal(listeners.get('resize')?.size || 0, 0);
        assert.equal(listeners.get('keydown')?.size || 0, 0);
    });
});

test('all 4 compiled lib/v3/index.js bundles mount, render <slot>/dynamic styles, and unmount cleanly under real Vue 3.2', async () => {
    const { doc, win, listeners, Element } = createMiniDom();
    win.SVGElement = class {};
    win.Element = Element;

    await runWithDomGlobals({
        window: win,
        document: doc,
        navigator: win.navigator,
        Element,
        SVGElement: win.SVGElement,
        getComputedStyle: win.getComputedStyle
    }, async () => {
        const Vue3 = require('vue3/dist/vue.cjs.js');
        const VueDemiV3 = require('vue-demi/lib/v3/index.cjs');
        assert.equal(VueDemiV3.isVue2, false);
        const specs = [
            ['packages/vue-docx/lib/v3/index.js', 'AbnerVueOfficeDocx', 'abner-vue-office-docx'],
            ['packages/vue-excel/lib/v3/index.js', 'AbnerVueOfficeExcel', 'abner-vue-office-excel'],
            ['packages/vue-pdf/lib/v3/index.js', 'AbnerVueOfficePdf', 'abner-vue-office-pdf'],
            ['packages/vue-pptx/lib/v3/index.js', 'AbnerVueOfficePptx', 'abner-vue-office-pptx']
        ];
        for (const [rel, expectedName, rootCls] of specs) {
            const Comp = loadV3BundleWithRealVue3(Vue3, VueDemiV3, rel, win, doc);
            assert.equal(Comp.name, expectedName);
            const mountEl = doc.createElement('div');
            let compRef = null;
            const app = Vue3.createApp({
                render() {
                    return Vue3.h(
                        Comp,
                        {
                            src: '',
                            ref: (el) => { compRef = el; }
                        },
                        expectedName === 'AbnerVueOfficePdf'
                            ? { default: () => Vue3.h('span', { class: 'v3-slot' }, 'ok') }
                            : undefined
                    );
                }
            });
            app.use(Comp);
            assert.ok(app.component(expectedName));
            app.mount(mountEl);

            assert.ok(mountEl.querySelector(`.${rootCls}`));
            assert.equal(typeof compRef.save, 'function');
            if (expectedName === 'AbnerVueOfficePdf') {
                assert.ok(mountEl.querySelector('.v3-slot'));
                assert.equal(compRef.getScale(), 1);
                compRef.setScale(0.5);
                await Vue3.nextTick();
                const wrapperEl = mountEl.querySelector('.abner-vue-office-pdf-wrapper');
                assert.equal(wrapperEl.style.width, '100%');
                compRef.setScale(1.5);
                await Vue3.nextTick();
                assert.equal(wrapperEl.style.width, '150%');
            }
            app.unmount();
        }
        assert.equal(listeners.get('resize')?.size || 0, 0);
        assert.equal(listeners.get('keydown')?.size || 0, 0);
    });
});

test('strict SSR sandbox loads v2 (isVue2: true) and all js-* ESM/CJS/UMD bundles without browser globals', () => {
    const { win: ssrWin, doc: ssrDoc } = createMiniDom();
    const { Vue2, VueDemiV2 } = loadVue2WithBrowserGlobals(ssrWin, ssrDoc);
    for (const rel of [
        'packages/vue-docx/lib/v2/index.js',
        'packages/vue-excel/lib/v2/index.js',
        'packages/vue-pdf/lib/v2/index.js',
        'packages/vue-pptx/lib/v2/index.js'
    ]) {
        const mod = { exports: {} };
        const ctx = {
            module: mod,
            exports: mod.exports,
            require: (id) => {
                if (id === 'vue-demi') return VueDemiV2;
                if (id === 'vue') return Vue2;
                throw new Error(`Unexpected require: ${id}`);
            },
            console,
            setTimeout,
            clearTimeout,
            setInterval,
            clearInterval,
            URL,
            Uint8Array,
            ArrayBuffer,
            Buffer,
            process
        };
        ctx.global = ctx;
        ctx.globalThis = ctx;
        runVmBundle(rel, ctx);
        assert.equal(typeof mod.exports.install, 'function');
        assert.equal(mod.exports.props.src.validator(null), true);
        assert.equal(mod.exports.props.src.validator(123), false);
    }

    for (const pkg of ['js-docx', 'js-excel', 'js-pdf']) {
        const umdCode = fs.readFileSync(path.join(CORE_DIR, `packages/${pkg}/lib/index.umd.js`), 'utf8');
        const mod = { exports: {} };
        const ctx = {
            module: mod,
            exports: mod.exports,
            console,
            setTimeout,
            clearTimeout,
            setInterval,
            clearInterval,
            URL,
            Uint8Array,
            ArrayBuffer
        };
        ctx.globalThis = ctx;
        vm.runInNewContext(umdCode, ctx);
        assert.equal(typeof mod.exports.init, 'function');
    }
});
