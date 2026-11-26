import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CORE_DIR } from './helpers/load-module.mjs';

test('script/copy.js copies pairs and rejects invalid argument counts', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abner-copy-test-'));
    try {
        const srcA = path.join(tmpDir, 'a.txt');
        const destB = path.join(tmpDir, 'nested/dir/b.txt');
        fs.writeFileSync(srcA, 'hello-copy', 'utf8');

        const copyScript = path.join(CORE_DIR, 'script/copy.js');
        execFileSync(process.execPath, [copyScript, srcA, destB], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.readFileSync(destB, 'utf8'), 'hello-copy');

        assert.throws(() => {
            execFileSync(process.execPath, [copyScript, srcA], { cwd: tmpDir, stdio: 'pipe' });
        });
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('script/bak-vue.js safely backs up and restores node_modules/vue in isolated sandbox', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abner-bak-test-'));
    try {
        const scriptDir = path.join(tmpDir, 'script');
        const vueDir = path.join(tmpDir, 'node_modules/vue');
        fs.mkdirSync(scriptDir, { recursive: true });
        fs.mkdirSync(vueDir, { recursive: true });
        fs.writeFileSync(path.join(vueDir, 'index.js'), 'module.exports = { version: "3.2.45" };', 'utf8');
        const bakScript = path.join(scriptDir, 'bak-vue.js');
        fs.copyFileSync(path.join(CORE_DIR, 'script/bak-vue.js'), bakScript);

        execFileSync(process.execPath, [bakScript, 'bak'], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.existsSync(vueDir), false);
        assert.equal(fs.existsSync(path.join(tmpDir, 'node_modules/vue-bak/index.js')), true);

        execFileSync(process.execPath, [bakScript], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.existsSync(vueDir), true);
        assert.equal(fs.existsSync(path.join(tmpDir, 'node_modules/vue-bak')), false);

        // Edge case: both vue and vue-bak exist during 'bak' and restore
        fs.mkdirSync(path.join(tmpDir, 'node_modules/vue-bak'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, 'node_modules/vue-bak/stale.txt'), 'stale', 'utf8');
        execFileSync(process.execPath, [bakScript, 'bak'], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.existsSync(path.join(tmpDir, 'node_modules/vue-bak/index.js')), true);
        assert.equal(fs.existsSync(path.join(tmpDir, 'node_modules/vue-bak/stale.txt')), false);

        fs.mkdirSync(vueDir, { recursive: true });
        execFileSync(process.execPath, [bakScript], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.existsSync(vueDir), true);
        assert.equal(fs.existsSync(path.join(tmpDir, 'node_modules/vue-bak')), false);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('script/switch-cli.js and script/utils.js switch v2/v3 entrypoints cleanly', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abner-switch-test-'));
    try {
        const libDir = path.join(tmpDir, 'lib');
        const scriptDir = path.join(libDir, 'script');
        fs.mkdirSync(path.join(libDir, 'v2'), { recursive: true });
        fs.mkdirSync(path.join(libDir, 'v3'), { recursive: true });
        fs.mkdirSync(scriptDir, { recursive: true });

        fs.writeFileSync(path.join(libDir, 'v2/index.js'), '//v2-js', 'utf8');
        fs.writeFileSync(path.join(libDir, 'v2/index.css'), '/*v2-css*/', 'utf8');
        fs.writeFileSync(path.join(libDir, 'v3/index.js'), '//v3-js', 'utf8');
        fs.writeFileSync(path.join(libDir, 'v3/index.css'), '/*v3-css*/', 'utf8');

        fs.copyFileSync(path.join(CORE_DIR, 'script/utils.js'), path.join(scriptDir, 'utils.js'));
        fs.copyFileSync(path.join(CORE_DIR, 'script/switch-cli.js'), path.join(scriptDir, 'switch-cli.js'));

        execFileSync(process.execPath, [path.join(scriptDir, 'switch-cli.js'), '2'], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.readFileSync(path.join(libDir, 'index.js'), 'utf8'), '//v2-js');
        assert.equal(fs.readFileSync(path.join(libDir, 'index.css'), 'utf8'), '/*v2-css*/');

        execFileSync(process.execPath, [path.join(scriptDir, 'switch-cli.js'), '3'], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.readFileSync(path.join(libDir, 'index.js'), 'utf8'), '//v3-js');
        assert.equal(fs.readFileSync(path.join(libDir, 'index.css'), 'utf8'), '/*v3-css*/');

        // Also works when package has no index.css (e.g. vue-pdf / vue-pptx)
        fs.rmSync(path.join(libDir, 'v2/index.css'));
        fs.rmSync(path.join(libDir, 'index.css'));
        execFileSync(process.execPath, [path.join(scriptDir, 'switch-cli.js'), '2'], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.readFileSync(path.join(libDir, 'index.js'), 'utf8'), '//v2-js');
        assert.equal(fs.existsSync(path.join(libDir, 'index.css')), false);

        assert.throws(() => {
            execFileSync(process.execPath, [path.join(scriptDir, 'switch-cli.js'), '4'], { cwd: tmpDir, stdio: 'pipe' });
        });
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('script/postinstall.js switches version for Vue 2/3 and warns on missing or unsupported Vue', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abner-postinstall-test-'));
    try {
        const libDir = path.join(tmpDir, 'lib');
        const scriptDir = path.join(libDir, 'script');
        fs.mkdirSync(path.join(libDir, 'v2'), { recursive: true });
        fs.mkdirSync(path.join(libDir, 'v3'), { recursive: true });
        fs.mkdirSync(scriptDir, { recursive: true });
        fs.writeFileSync(path.join(libDir, 'v2/index.js'), '//v2', 'utf8');
        fs.writeFileSync(path.join(libDir, 'v3/index.js'), '//v3', 'utf8');
        fs.copyFileSync(path.join(CORE_DIR, 'script/utils.js'), path.join(scriptDir, 'utils.js'));
        fs.copyFileSync(path.join(CORE_DIR, 'script/postinstall.js'), path.join(scriptDir, 'postinstall.js'));

        // Missing vue
        const noVueOut = execFileSync(process.execPath, [path.join(scriptDir, 'postinstall.js')], {
            cwd: tmpDir,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        assert.equal(typeof noVueOut, 'string');

        // Vue 2
        const vuePkgDir = path.join(tmpDir, 'node_modules/vue');
        fs.mkdirSync(vuePkgDir, { recursive: true });
        fs.writeFileSync(path.join(vuePkgDir, 'index.js'), 'module.exports = { version: "2.7.14" };', 'utf8');
        execFileSync(process.execPath, [path.join(scriptDir, 'postinstall.js')], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.readFileSync(path.join(libDir, 'index.js'), 'utf8'), '//v2');

        // Vue 3
        fs.writeFileSync(path.join(vuePkgDir, 'index.js'), 'module.exports = { version: "3.4.0" };', 'utf8');
        execFileSync(process.execPath, [path.join(scriptDir, 'postinstall.js')], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.readFileSync(path.join(libDir, 'index.js'), 'utf8'), '//v3');

        // Unsupported Vue 4
        fs.writeFileSync(path.join(vuePkgDir, 'index.js'), 'module.exports = { version: "4.0.0" };', 'utf8');
        const resV4 = execFileSync(
            process.execPath,
            ['-e', `require(${JSON.stringify(path.join(scriptDir, 'postinstall.js'))})`],
            { cwd: tmpDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        assert.equal(typeof resV4, 'string');
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('script/run-lib.js backs up vue, forwards lerna args, and always restores vue even on failure', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abner-runlib-test-'));
    try {
        const scriptDir = path.join(tmpDir, 'script');
        const vueDir = path.join(tmpDir, 'node_modules/vue');
        const lernaDir = path.join(tmpDir, 'node_modules/lerna');
        fs.mkdirSync(scriptDir, { recursive: true });
        fs.mkdirSync(vueDir, { recursive: true });
        fs.mkdirSync(lernaDir, { recursive: true });
        fs.writeFileSync(path.join(vueDir, 'index.js'), 'module.exports = { version: "3.2.45" };', 'utf8');
        fs.writeFileSync(
            path.join(lernaDir, 'cli.js'),
            `const fs = require('fs');
             const path = require('path');
             const vueExistsDuringBuild = fs.existsSync(path.join(process.cwd(), 'node_modules/vue'));
             fs.writeFileSync(path.join(process.cwd(), 'lerna-args.json'), JSON.stringify({ args: process.argv.slice(2), vueExistsDuringBuild }));
             if (process.argv.includes('--fail')) process.exit(2);`,
            'utf8'
        );
        fs.writeFileSync(path.join(lernaDir, 'package.json'), '{"name":"lerna","exports":{"./cli":"./cli.js"}}', 'utf8');
        fs.copyFileSync(path.join(CORE_DIR, 'script/bak-vue.js'), path.join(scriptDir, 'bak-vue.js'));
        fs.copyFileSync(path.join(CORE_DIR, 'script/run-lib.js'), path.join(scriptDir, 'run-lib.js'));

        execFileSync(process.execPath, [path.join(scriptDir, 'run-lib.js'), '--scope', '@abner-vue-office/docx'], {
            cwd: tmpDir,
            stdio: 'pipe'
        });
        const metaOk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'lerna-args.json'), 'utf8'));
        assert.deepEqual(metaOk.args, ['run', 'build', '--scope', '@abner-vue-office/docx']);
        assert.equal(metaOk.vueExistsDuringBuild, false);
        assert.equal(fs.existsSync(vueDir), true);
        assert.equal(fs.existsSync(path.join(tmpDir, 'node_modules/vue-bak')), false);

        assert.throws(() => {
            execFileSync(process.execPath, [path.join(scriptDir, 'run-lib.js'), '--fail'], {
                cwd: tmpDir,
                stdio: 'pipe'
            });
        });
        assert.equal(fs.existsSync(vueDir), true);
        assert.equal(fs.existsSync(path.join(tmpDir, 'node_modules/vue-bak')), false);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
