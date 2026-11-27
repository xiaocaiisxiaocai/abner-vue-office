import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getUrl,
    getUrlAsync,
    revokeUrl,
    normalizeFetchOptions,
    loadScript,
    download,
    downloadFile
} from '../utils/url.js';
import { isTest } from '../utils/test.js';
import { createDomMocks, runWithDomGlobals } from './helpers/load-module.mjs';

test('normalizeFetchOptions sanitizes credentials, responseType, and GET/HEAD body', () => {
    assert.deepEqual(normalizeFetchOptions(null), {});
    assert.deepEqual(normalizeFetchOptions(undefined), {});
    assert.deepEqual(normalizeFetchOptions('invalid'), {});

    const orig = {
        method: 'GET',
        withCredentials: true,
        responseType: 'arraybuffer',
        body: '',
        headers: { 'X-Test': '1' }
    };
    const normalized = normalizeFetchOptions(orig);
    assert.deepEqual(normalized, {
        method: 'GET',
        credentials: 'include',
        headers: { 'X-Test': '1' }
    });
    assert.equal('withCredentials' in normalized, false);
    assert.equal('responseType' in normalized, false);
    assert.equal('body' in normalized, false);
    assert.equal(orig.withCredentials, true);

    assert.equal('body' in normalizeFetchOptions({ body: 'omitted-method' }), false);
    assert.equal(normalizeFetchOptions({ withCredentials: false }).credentials, undefined);

    const headNull = normalizeFetchOptions({ method: 'head', body: null });
    assert.equal('body' in headNull, false);

    const spaceGet = normalizeFetchOptions({ method: ' GET ', body: 'bad' });
    assert.equal('body' in spaceGet, false);
    const spaceHead = normalizeFetchOptions({ method: ' Head ', body: '' });
    assert.equal('body' in spaceHead, false);

    const postReq = normalizeFetchOptions({
        method: 'POST',
        withCredentials: true,
        credentials: 'same-origin',
        body: '{"ok":true}'
    });
    assert.equal(postReq.credentials, 'same-origin');
    assert.equal(postReq.body, '{"ok":true}');

    const putReq = normalizeFetchOptions({ method: 'PUT', body: '{"id":1}' });
    assert.equal(putReq.body, '{"id":1}');
});

test('getUrl and getUrlAsync handle string, ArrayBuffer, Blob, ArrayBufferView slice, Response, and fallbacks', async () => {
    const created = [];
    const revoked = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (blob) => {
        const url = `blob:mock-${created.length}`;
        created.push({ url, blob });
        return url;
    };
    URL.revokeObjectURL = (url) => {
        revoked.push(url);
    };

    try {
        assert.equal(getUrl('https://example.com/a.docx'), 'https://example.com/a.docx');
        assert.equal(await getUrlAsync('https://example.com/b.pdf'), 'https://example.com/b.pdf');
        assert.equal(getUrl(null), null);
        assert.equal(await getUrlAsync(123), 123);

        const rawAb = new Uint8Array([4, 5, 6]).buffer;
        const abUrl = getUrl(rawAb, { type: 'application/pdf' });
        assert.match(abUrl, /^blob:mock-/);
        assert.equal(created[created.length - 1].blob.type, 'application/pdf');
        assert.match(await getUrlAsync(rawAb, { type: 'application/pdf' }), /^blob:mock-/);

        const blobInput = new Blob(['abc'], { type: 'text/plain' });
        assert.match(getUrl(blobInput), /^blob:mock-/);
        assert.match(await getUrlAsync(blobInput), /^blob:mock-/);

        const slab = new Uint8Array([10, 20, 30, 40, 50]);
        const subView = slab.subarray(1, 4);
        const viewUrl = getUrl(subView, { type: 'application/pdf' });
        assert.match(viewUrl, /^blob:mock-/);
        const lastBlob = created[created.length - 1].blob;
        assert.deepEqual(Array.from(new Uint8Array(await lastBlob.arrayBuffer())), [20, 30, 40]);

        const resp = new Response(new Uint8Array([1, 2, 3]), { status: 200 });
        const respUrl = await getUrlAsync(resp);
        assert.match(respUrl, /^blob:mock-/);

        const failingResp = Object.create(Response.prototype);
        failingResp.blob = () => Promise.reject(new Error('stream consumed'));
        await assert.rejects(getUrlAsync(failingResp), /stream consumed/);

        revokeUrl('https://example.com/plain.pdf');
        revokeUrl(null);
        revokeUrl('blob:mock-0');
        assert.deepEqual(revoked, ['blob:mock-0']);
    } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
    }
});

test('loadScript validates src, uses head/documentElement fallbacks, and cleans up failed script elements', async () => {
    const { mockDocument } = createDomMocks();
    await runWithDomGlobals({ document: mockDocument }, async () => {
        await assert.rejects(loadScript(''), /Failed to load script/);
        await assert.rejects(loadScript(null), /Failed to load script/);

        const p1 = loadScript('https://example.com/good.js');
        assert.equal(mockDocument.body.children.length, 1);
        const s1 = mockDocument.body.children[0];
        s1.onload();
        assert.equal(s1.onload, null);
        await p1;

        const p2 = loadScript('https://example.com/bad.js');
        const s2 = mockDocument.body.children[1];
        s2.onerror();
        await assert.rejects(p2, /Failed to load script: https:\/\/example\.com\/bad\.js/);
        assert.equal(mockDocument.body.children.length, 1);

        const noBodyDoc = {
            body: null,
            head: mockDocument.head,
            documentElement: mockDocument.documentElement,
            createElement: mockDocument.createElement.bind(mockDocument)
        };
        await runWithDomGlobals({ document: noBodyDoc }, async () => {
            const p3 = loadScript('https://example.com/head.js');
            assert.equal(noBodyDoc.head.children.length, 1);
            noBodyDoc.head.children[0].onload();
            await p3;
        });

        const docElOnly = {
            body: null,
            head: null,
            documentElement: mockDocument.createElement('html'),
            createElement: mockDocument.createElement.bind(mockDocument)
        };
        await runWithDomGlobals({ document: docElOnly }, async () => {
            const p4 = loadScript('https://example.com/docel.js');
            assert.equal(docElOnly.documentElement.children.length, 1);
            docElOnly.documentElement.children[0].onload();
            await p4;
        });
    });
});

test('download and downloadFile validate inputs, guard SSR/no-target, and revoke URL even on throw', async () => {
    const { mockDocument } = createDomMocks();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const clicked = [];
    const revoked = [];
    let revokeDelay = 0;
    URL.createObjectURL = () => 'blob:download-1';
    URL.revokeObjectURL = (url) => {
        revoked.push(url);
    };

    const origCreateEl = mockDocument.createElement.bind(mockDocument);
    mockDocument.createElement = (tag) => {
        const el = origCreateEl(tag);
        if (tag === 'a') {
            el.click = () => {
                clicked.push({ download: el.download, href: el.href, display: el.style.display });
            };
        }
        return el;
    };

    const immediateTimer = (fn, ms) => {
        revokeDelay = ms;
        fn();
        return 0;
    };

    try {
        await runWithDomGlobals({ document: mockDocument, setTimeout: immediateTimer }, async () => {
            downloadFile('empty.docx', '');
            downloadFile(null, 'https://example.com/file.pdf');
            assert.equal(clicked.length, 1);
            assert.equal(clicked[0].download, '');

            await download('empty.docx', null);
            await download('bad.docx', 'not-a-blob');
            await download('bad2.docx', { foo: 1 });
            assert.equal(clicked.length, 1);

            await download('good.docx', new Uint8Array([1, 2, 3]));
            assert.equal(clicked.length, 2);
            assert.equal(clicked[1].download, 'good.docx');
            assert.equal(clicked[1].href, 'blob:download-1');
            assert.equal(clicked[1].display, 'none');
            assert.equal(revokeDelay, 10000);
            assert.deepEqual(revoked, ['blob:download-1']);

            await download('ab.docx', new Uint8Array([9, 8]).buffer);
            await download('blob.docx', new Blob(['hi']));
            assert.equal(clicked.length, 4);
        });

        await runWithDomGlobals({ document: undefined }, async () => {
            downloadFile('ssr.docx', 'https://example.com/a.docx');
            await download('ssr.docx', new Uint8Array([1]));
        });

        await runWithDomGlobals({ document: { body: null, documentElement: null, createElement: () => ({}) } }, async () => {
            downloadFile('notarget.docx', 'https://example.com/a.docx');
            await download('notarget.docx', new Blob(['hi']));
        });

        await runWithDomGlobals({ document: mockDocument, Blob: undefined }, async () => {
            await download('ssr-no-blob.docx', new Uint8Array([1, 2]));
            await download('ssr-no-blob-ab.docx', new ArrayBuffer(4));
        });

        await runWithDomGlobals({ document: mockDocument, URL: undefined }, async () => {
            await download('ssr-no-url.docx', new Blob(['hi']));
            revokeUrl('blob:safe-noop');
            assert.equal(getUrl('https://example.com/ok.pdf'), 'https://example.com/ok.pdf');
            const u8 = new Uint8Array([1, 2]);
            assert.equal(await getUrlAsync(u8), getUrl(u8));
        });

        const throwingDoc = {
            body: mockDocument.createElement('body'),
            createElement: (tag) => {
                const el = origCreateEl(tag);
                if (tag === 'a') {
                    el.click = () => {
                        throw new Error('click blocked');
                    };
                }
                return el;
            }
        };
        revoked.length = 0;
        await runWithDomGlobals({ document: throwingDoc, setTimeout: immediateTimer }, async () => {
            await assert.rejects(download('throw.docx', new Blob(['err'])), /click blocked/);
            assert.equal(throwingDoc.body.children.length, 0);
            assert.deepEqual(revoked, ['blob:download-1']);
        });

        const noBodyDoc = {
            body: null,
            head: mockDocument.head,
            documentElement: mockDocument.documentElement,
            createElement: mockDocument.createElement.bind(mockDocument)
        };
        const origCreateElNoBody = noBodyDoc.createElement;
        noBodyDoc.createElement = (tag) => {
            const el = origCreateElNoBody(tag);
            if (tag === 'a') {
                el.click = () => clicked.push({ download: el.download, href: el.href });
            }
            return el;
        };
        await runWithDomGlobals({ document: noBodyDoc, setTimeout: immediateTimer }, async () => {
            await download('fallback.docx', new Blob(['ok']));
            assert.equal(clicked[clicked.length - 1].download, 'fallback.docx');
        });
    } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
    }
});

test('getUrl/getUrlAsync are SSR safe when Blob/Response are undefined and loadScript rejects without DOM mount target', async () => {
    await runWithDomGlobals({ Blob: undefined, Response: undefined }, async () => {
        assert.equal(getUrl('https://example.com/a.docx'), 'https://example.com/a.docx');
        assert.equal(await getUrlAsync('https://example.com/b.pdf'), 'https://example.com/b.pdf');
        const u8 = new Uint8Array([1, 2]);
        const ab = new ArrayBuffer(4);
        assert.equal(getUrl(u8), u8);
        assert.equal(await getUrlAsync(ab), ab);
    });

    const emptyDoc = {
        body: null,
        head: null,
        documentElement: null,
        createElement: () => ({})
    };
    await runWithDomGlobals({ document: emptyDoc }, async () => {
        await assert.rejects(loadScript('https://example.com/no-target.js'), /Failed to load script/);
    });

    await runWithDomGlobals({ document: undefined }, async () => {
        await assert.rejects(loadScript('https://example.com/ssr.js'), /Failed to load script/);
    });
});

test('utils/test.js isTest only matches explicit test query param and rejects hostname/file substrings', async () => {
    await runWithDomGlobals({ location: { search: '', hash: '#/docx?test=1', href: 'http://localhost:5173/#/docx?test=1' } }, () => {
        assert.equal(isTest(), true);
    });
    await runWithDomGlobals({ location: { search: '?test', hash: '#/docx', href: 'http://localhost:5173/?test#/docx' } }, () => {
        assert.equal(isTest(), true);
    });
    await runWithDomGlobals({ location: { search: '?test=0', hash: '#/docx', href: 'http://localhost:5173/?test=0#/docx' } }, () => {
        assert.equal(isTest(), false);
    });
    await runWithDomGlobals({ location: { search: '', hash: '#/docx?file=test.docx', href: 'https://test.example.com/#/docx?file=test.docx' } }, () => {
        assert.equal(isTest(), false);
    });
    await runWithDomGlobals({ location: {} }, () => {
        assert.equal(isTest(), false);
    });
    await runWithDomGlobals({ location: undefined }, () => {
        assert.equal(isTest(), false);
    });
});
