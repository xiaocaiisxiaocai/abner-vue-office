const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const coreDir = path.resolve(__dirname, '..');
const bakVueScript = path.resolve(__dirname, 'bak-vue.js');
const lernaArgs = process.argv.slice(2);

let restored = false;
function restoreEnvironment() {
    if (restored) {
        return;
    }
    restored = true;
    spawnSync(process.execPath, [bakVueScript], {
        cwd: coreDir,
        stdio: 'inherit'
    });
    const vueDir = path.join(coreDir, 'node_modules/vue');
    const switchScript = path.join(coreDir, 'node_modules/vue-demi/bin/vue-demi-switch.js');
    if (fs.existsSync(vueDir) && fs.existsSync(switchScript)) {
        spawnSync(process.execPath, [switchScript, '3', 'vue'], {
            cwd: coreDir,
            stdio: 'ignore'
        });
    }
}

function handleSignal(sig) {
    restoreEnvironment();
    process.exit(sig === 'SIGINT' ? 130 : 143);
}
process.once('SIGINT', handleSignal);
process.once('SIGTERM', handleSignal);

let exitCode = 1;
try {
    const bakResult = spawnSync(process.execPath, [bakVueScript, 'bak'], {
        cwd: coreDir,
        stdio: 'inherit'
    });
    if (bakResult.status !== 0) {
        exitCode = typeof bakResult.status === 'number' ? bakResult.status : 1;
    } else {
        const lernaCli = require.resolve('lerna/cli', { paths: [coreDir] });
        const runResult = spawnSync(process.execPath, [lernaCli, 'run', 'build', ...lernaArgs], {
            cwd: coreDir,
            stdio: 'inherit'
        });
        exitCode = typeof runResult.status === 'number' ? runResult.status : 1;
    }
} finally {
    process.removeListener('SIGINT', handleSignal);
    process.removeListener('SIGTERM', handleSignal);
    restoreEnvironment();
}

process.exit(exitCode);
