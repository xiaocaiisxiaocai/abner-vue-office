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
        process.exit(bakResult.status || 1);
    }

    const lernaCmd = process.platform === 'win32' ? 'lerna.cmd' : 'lerna';
    const lernaBin = path.resolve(coreDir, 'node_modules/.bin', lernaCmd);
    const runResult = spawnSync(lernaBin, ['run', 'build', ...lernaArgs], {
        cwd: coreDir,
        stdio: 'inherit',
        shell: process.platform === 'win32'
    });
    exitCode = typeof runResult.status === 'number' ? runResult.status : 1;
} finally {
    spawnSync(process.execPath, [bakVueScript], {
        cwd: coreDir,
        stdio: 'inherit'
    });
}

process.exit(exitCode);
