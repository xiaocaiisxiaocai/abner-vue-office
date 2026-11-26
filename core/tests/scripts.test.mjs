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

        assert.throws(() => {
            execFileSync(process.execPath, [path.join(scriptDir, 'switch-cli.js'), '4'], { cwd: tmpDir, stdio: 'pipe' });
        });
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
