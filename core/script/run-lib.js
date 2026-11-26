const path = require('path');
const { spawnSync } = require('child_process');

const coreDir = path.resolve(__dirname, '..');
const bakVueScript = path.resolve(__dirname, 'bak-vue.js');
const lernaArgs = process.argv.slice(2);

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
    spawnSync(process.execPath, [bakVueScript], {
        cwd: coreDir,
        stdio: 'inherit'
    });
}

process.exit(exitCode);
