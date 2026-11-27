import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { CORE_DIR } from './helpers/load-module.mjs';

const require = createRequire(import.meta.url);

test('script/copy.js copies single and multiple pairs and rejects invalid/missing args', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abner-copy-test-'));
    try {
        const srcA = path.join(tmpDir, 'a.txt');
        const srcB = path.join(tmpDir, 'b.txt');
        const destA = path.join(tmpDir, 'nested/dir/a.txt');
        const destB = path.join(tmpDir, 'nested/dir/b.txt');
        fs.writeFileSync(srcA, 'hello-a', 'utf8');
        fs.writeFileSync(srcB, 'hello-b', 'utf8');
        fs.mkdirSync(path.dirname(destA), { recursive: true });
        fs.writeFileSync(destA, 'old', 'utf8');

        const copyScript = path.join(CORE_DIR, 'script/copy.js');
        execFileSync(process.execPath, [copyScript, srcA, destA, srcB, destB], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.readFileSync(destA, 'utf8'), 'hello-a');
        assert.equal(fs.readFileSync(destB, 'utf8'), 'hello-b');

        const zeroRes = spawnSync(process.execPath, [copyScript], { cwd: tmpDir, encoding: 'utf8' });
        assert.equal(zeroRes.status, 1);
        assert.match(zeroRes.stderr, /requires pairs/);

        const oddRes = spawnSync(process.execPath, [copyScript, srcA], { cwd: tmpDir, encoding: 'utf8' });
        assert.equal(oddRes.status, 1);

        const missingRes = spawnSync(process.execPath, [copyScript, path.join(tmpDir, 'missing.txt'), destA], {
            cwd: tmpDir,
            encoding: 'utf8'
        });
        assert.notEqual(missingRes.status, 0);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('script/bak-vue.js safely backs up and restores node_modules/vue including missing-dir edge cases', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abner-bak-test-'));
    try {
        const scriptDir = path.join(tmpDir, 'script');
        const vueDir = path.join(tmpDir, 'node_modules/vue');
        const vueBakDir = path.join(tmpDir, 'node_modules/vue-bak');
        fs.mkdirSync(scriptDir, { recursive: true });
        const bakScript = path.join(scriptDir, 'bak-vue.js');
        fs.copyFileSync(path.join(CORE_DIR, 'script/bak-vue.js'), bakScript);

        // Neither exists
        execFileSync(process.execPath, [bakScript, 'bak'], { cwd: tmpDir, stdio: 'pipe' });
        execFileSync(process.execPath, [bakScript], { cwd: tmpDir, stdio: 'pipe' });

        // Normal backup & restore
        fs.mkdirSync(vueDir, { recursive: true });
        fs.writeFileSync(path.join(vueDir, 'index.js'), 'module.exports = { version: "3.2.45" };', 'utf8');
        execFileSync(process.execPath, [bakScript, 'bak'], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.existsSync(vueDir), false);
        assert.equal(fs.existsSync(path.join(vueBakDir, 'index.js')), true);

        // Second 'bak' when only vue-bak exists must preserve vue-bak
        execFileSync(process.execPath, [bakScript, 'bak'], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.existsSync(path.join(vueBakDir, 'index.js')), true);

        execFileSync(process.execPath, [bakScript], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.existsSync(vueDir), true);
        assert.equal(fs.existsSync(vueBakDir), false);

        // Edge case: both vue and vue-bak exist during 'bak' and restore
        fs.mkdirSync(vueBakDir, { recursive: true });
        fs.writeFileSync(path.join(vueBakDir, 'stale.txt'), 'stale', 'utf8');
        execFileSync(process.execPath, [bakScript, 'bak'], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.existsSync(path.join(vueBakDir, 'index.js')), true);
        assert.equal(fs.existsSync(path.join(vueBakDir, 'stale.txt')), false);

        fs.mkdirSync(vueDir, { recursive: true });
        execFileSync(process.execPath, [bakScript], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.existsSync(vueDir), true);
        assert.equal(fs.existsSync(vueBakDir), false);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('script/switch-cli.js and script/utils.js switch v2/v3 entrypoints cleanly and report invalid args', () => {
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

        // Direct utils.js loadModule / switchVersion checks
        const utilsMod = require(path.join(scriptDir, 'utils.js'));
        assert.equal(utilsMod.loadModule('definitely-missing-pkg-xyz'), undefined);
        assert.ok(utilsMod.loadModule('path'));
        utilsMod.switchVersion(99); // missing v99 dir is a safe no-op

        execFileSync(process.execPath, [path.join(scriptDir, 'switch-cli.js'), '2'], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.readFileSync(path.join(libDir, 'index.js'), 'utf8'), '//v2-js');
        assert.equal(fs.readFileSync(path.join(libDir, 'index.css'), 'utf8'), '/*v2-css*/');

        execFileSync(process.execPath, [path.join(scriptDir, 'switch-cli.js'), '3'], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.readFileSync(path.join(libDir, 'index.js'), 'utf8'), '//v3-js');
        assert.equal(fs.readFileSync(path.join(libDir, 'index.css'), 'utf8'), '/*v3-css*/');

        fs.rmSync(path.join(libDir, 'v2/index.css'));
        fs.rmSync(path.join(libDir, 'index.css'));
        execFileSync(process.execPath, [path.join(scriptDir, 'switch-cli.js'), '2'], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.readFileSync(path.join(libDir, 'index.js'), 'utf8'), '//v2-js');
        assert.equal(fs.existsSync(path.join(libDir, 'index.css')), false);

        const badRes = spawnSync(process.execPath, [path.join(scriptDir, 'switch-cli.js'), '4'], {
            cwd: tmpDir,
            encoding: 'utf8'
        });
        assert.equal(badRes.status, 1);
        assert.match(badRes.stderr, /expecting version "2" or "3" but got "4"/);

        const missingRes = spawnSync(process.execPath, [path.join(scriptDir, 'switch-cli.js')], {
            cwd: tmpDir,
            encoding: 'utf8'
        });
        assert.equal(missingRes.status, 1);
        assert.match(missingRes.stderr, /got "undefined"/);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('script/postinstall.js switches version + CSS for Vue 2/3 and warns on missing/malformed/unsupported Vue', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abner-postinstall-test-'));
    try {
        const libDir = path.join(tmpDir, 'lib');
        const scriptDir = path.join(libDir, 'script');
        fs.mkdirSync(path.join(libDir, 'v2'), { recursive: true });
        fs.mkdirSync(path.join(libDir, 'v3'), { recursive: true });
        fs.mkdirSync(scriptDir, { recursive: true });
        fs.writeFileSync(path.join(libDir, 'v2/index.js'), '//v2', 'utf8');
        fs.writeFileSync(path.join(libDir, 'v2/index.css'), '/*v2*/', 'utf8');
        fs.writeFileSync(path.join(libDir, 'v3/index.js'), '//v3', 'utf8');
        fs.writeFileSync(path.join(libDir, 'v3/index.css'), '/*v3*/', 'utf8');
        fs.writeFileSync(path.join(libDir, 'index.js'), '//initial', 'utf8');
        fs.copyFileSync(path.join(CORE_DIR, 'script/utils.js'), path.join(scriptDir, 'utils.js'));
        fs.copyFileSync(path.join(CORE_DIR, 'script/postinstall.js'), path.join(scriptDir, 'postinstall.js'));

        // Missing vue
        const noVueRes = spawnSync(process.execPath, [path.join(scriptDir, 'postinstall.js')], {
            cwd: tmpDir,
            encoding: 'utf8'
        });
        assert.equal(noVueRes.status, 0);
        assert.match(noVueRes.stderr, /Vue is not found/);
        assert.equal(fs.readFileSync(path.join(libDir, 'index.js'), 'utf8'), '//initial');

        // Vue 2
        const vuePkgDir = path.join(tmpDir, 'node_modules/vue');
        fs.mkdirSync(vuePkgDir, { recursive: true });
        fs.writeFileSync(path.join(vuePkgDir, 'index.js'), 'module.exports = { version: "2.7.14" };', 'utf8');
        execFileSync(process.execPath, [path.join(scriptDir, 'postinstall.js')], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.readFileSync(path.join(libDir, 'index.js'), 'utf8'), '//v2');
        assert.equal(fs.readFileSync(path.join(libDir, 'index.css'), 'utf8'), '/*v2*/');

        // Vue 3
        fs.writeFileSync(path.join(vuePkgDir, 'index.js'), 'module.exports = { version: "3.4.0" };', 'utf8');
        execFileSync(process.execPath, [path.join(scriptDir, 'postinstall.js')], { cwd: tmpDir, stdio: 'pipe' });
        assert.equal(fs.readFileSync(path.join(libDir, 'index.js'), 'utf8'), '//v3');
        assert.equal(fs.readFileSync(path.join(libDir, 'index.css'), 'utf8'), '/*v3*/');

        // Non-string version
        fs.writeFileSync(path.join(vuePkgDir, 'index.js'), 'module.exports = { version: 3 };', 'utf8');
        const badVerRes = spawnSync(process.execPath, [path.join(scriptDir, 'postinstall.js')], {
            cwd: tmpDir,
            encoding: 'utf8'
        });
        assert.equal(badVerRes.status, 0);
        assert.match(badVerRes.stderr, /Vue is not found/);

        // Unsupported Vue 4
        fs.writeFileSync(path.join(vuePkgDir, 'index.js'), 'module.exports = { version: "4.0.0" };', 'utf8');
        const resV4 = spawnSync(process.execPath, [path.join(scriptDir, 'postinstall.js')], {
            cwd: tmpDir,
            encoding: 'utf8'
        });
        assert.equal(resV4.status, 0);
        assert.match(resV4.stderr, /v4\.0\.0 is not supported/);
        assert.equal(fs.readFileSync(path.join(libDir, 'index.js'), 'utf8'), '//v3');
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('script/run-lib.js forwards args, restores vue + vue-demi on failure/missing lerna', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abner-runlib-test-'));
    try {
        const scriptDir = path.join(tmpDir, 'script');
        const vueDir = path.join(tmpDir, 'node_modules/vue');
        const lernaDir = path.join(tmpDir, 'node_modules/lerna');
        const vueDemiBin = path.join(tmpDir, 'node_modules/vue-demi/bin');
        fs.mkdirSync(scriptDir, { recursive: true });
        fs.mkdirSync(vueDir, { recursive: true });
        fs.mkdirSync(lernaDir, { recursive: true });
        fs.mkdirSync(vueDemiBin, { recursive: true });
        fs.writeFileSync(path.join(vueDir, 'index.js'), 'module.exports = { version: "3.2.45" };', 'utf8');
        fs.writeFileSync(
            path.join(vueDemiBin, 'vue-demi-switch.js'),
            'const fs = require("fs"); const path = require("path"); fs.writeFileSync(path.join(process.cwd(), "vue-demi-restored.txt"), process.argv.slice(2).join(" "));',
            'utf8'
        );
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

        // No extra args -> ['run', 'build']
        execFileSync(process.execPath, [path.join(scriptDir, 'run-lib.js')], { cwd: tmpDir, stdio: 'pipe' });
        const metaDefault = JSON.parse(fs.readFileSync(path.join(tmpDir, 'lerna-args.json'), 'utf8'));
        assert.deepEqual(metaDefault.args, ['run', 'build']);
        assert.equal(metaDefault.vueExistsDuringBuild, false);
        assert.equal(fs.readFileSync(path.join(tmpDir, 'vue-demi-restored.txt'), 'utf8'), '3 vue');

        // With scope args
        execFileSync(process.execPath, [path.join(scriptDir, 'run-lib.js'), '--scope', '@abner-vue-office/docx'], {
            cwd: tmpDir,
            stdio: 'pipe'
        });
        const metaOk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'lerna-args.json'), 'utf8'));
        assert.deepEqual(metaOk.args, ['run', 'build', '--scope', '@abner-vue-office/docx']);

        // Failure exit code forwarded + vue restored
        const failRes = spawnSync(process.execPath, [path.join(scriptDir, 'run-lib.js'), '--fail'], {
            cwd: tmpDir,
            encoding: 'utf8'
        });
        assert.equal(failRes.status, 2);
        assert.equal(fs.existsSync(vueDir), true);
        assert.equal(fs.existsSync(path.join(tmpDir, 'node_modules/vue-bak')), false);

        // Missing lerna/cli still restores vue in finally
        fs.rmSync(lernaDir, { recursive: true, force: true });
        assert.throws(() => {
            execFileSync(process.execPath, [path.join(scriptDir, 'run-lib.js')], { cwd: tmpDir, stdio: 'pipe' });
        });
        assert.equal(fs.existsSync(vueDir), true);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
