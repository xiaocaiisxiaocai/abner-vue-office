const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const coreDir = path.resolve(__dirname, '..');
const bakVueScript = path.resolve(__dirname, 'bak-vue.js');
const rawArgs = process.argv.slice(2);
const hasConcurrencyFlag = rawArgs.some(arg => arg === '--concurrency' || arg.startsWith('--concurrency='));
const lernaArgs = hasConcurrencyFlag ? rawArgs : [...rawArgs, '--concurrency=1'];

function entryExists(targetPath) {
    try {
        fs.lstatSync(targetPath);
        return true;
    } catch (err) {
        return !(err && err.code === 'ENOENT');
    }
}

function resolveVueDemiSwitch() {
    try {
        return require.resolve('vue-demi/bin/vue-demi-switch.js', { paths: [coreDir] });
    } catch (e) {
        const fallback = path.join(coreDir, 'node_modules/vue-demi/bin/vue-demi-switch.js');
        return fs.existsSync(fallback) ? fallback : null;
    }
}

let restored = false;
function restoreEnvironment() {
    if (restored) {
        return true;
    }
    restored = true;
    let ok = true;
    const restoreVue = spawnSync(process.execPath, [bakVueScript], {
        cwd: coreDir,
        stdio: 'inherit'
    });
    if (restoreVue.error || restoreVue.status !== 0) {
        ok = false;
        if (restoreVue.error) {
            console.error('[abner-vue-office] Failed to restore node_modules/vue:', restoreVue.error);
        }
    }
    const vueDir = path.join(coreDir, 'node_modules/vue');
    const switchScript = resolveVueDemiSwitch();
    if (entryExists(vueDir) && switchScript) {
        const switchRes = spawnSync(process.execPath, [switchScript, '3', 'vue'], {
            cwd: coreDir,
            stdio: 'pipe',
            encoding: 'utf8'
        });
        if (switchRes.error || switchRes.status !== 0) {
            ok = false;
            console.error('[abner-vue-office] Failed to restore vue-demi to Vue 3:', switchRes.error || switchRes.stderr);
        }
    }
    return ok;
}

function runChildAsync(cmd, args, options) {
    return new Promise((resolve) => {
        let activeChild = null;
        let receivedSignal = null;
        const forwardSignal = (sig) => {
            receivedSignal = sig;
            if (activeChild && !activeChild.killed) {
                try {
                    activeChild.kill(sig);
                } catch (e) {
                    // ignore
                }
            }
        };
        process.once('SIGINT', forwardSignal);
        process.once('SIGTERM', forwardSignal);

        const cleanupListeners = () => {
            process.removeListener('SIGINT', forwardSignal);
            process.removeListener('SIGTERM', forwardSignal);
        };

        try {
            activeChild = spawn(cmd, args, options);
        } catch (err) {
            cleanupListeners();
            resolve({ status: 1, signal: receivedSignal, error: err });
            return;
        }

        activeChild.on('error', (err) => {
            cleanupListeners();
            resolve({ status: 1, signal: receivedSignal, error: err });
        });
        activeChild.on('close', (code, signal) => {
            cleanupListeners();
            resolve({ status: code, signal: signal || receivedSignal, error: null });
        });
    });
}

async function main() {
    let exitCode = 1;
    try {
        const bakResult = spawnSync(process.execPath, [bakVueScript, 'bak'], {
            cwd: coreDir,
            stdio: 'inherit'
        });
        if (bakResult.error || bakResult.status !== 0) {
            if (bakResult.error) {
                console.error('[abner-vue-office] Failed to back up node_modules/vue:', bakResult.error);
            }
            exitCode = typeof bakResult.status === 'number' ? bakResult.status : 1;
        } else {
            const lernaCli = require.resolve('lerna/cli', { paths: [coreDir] });
            const runResult = await runChildAsync(process.execPath, [lernaCli, 'run', 'build', ...lernaArgs], {
                cwd: coreDir,
                stdio: 'inherit'
            });
            if (runResult.error) {
                console.error('[abner-vue-office] Failed to run lerna build:', runResult.error);
                exitCode = 1;
            } else if (runResult.signal) {
                exitCode = runResult.signal === 'SIGINT' ? 130 : (runResult.signal === 'SIGTERM' ? 143 : 1);
            } else {
                exitCode = typeof runResult.status === 'number' ? runResult.status : 1;
            }
        }
    } finally {
        const restoreOk = restoreEnvironment();
        if (!restoreOk && exitCode === 0) {
            exitCode = 1;
        }
    }
    process.exit(exitCode);
}

main().catch((err) => {
    console.error('[abner-vue-office] Unexpected error in run-lib.js:', err);
    restoreEnvironment();
    process.exit(1);
});
