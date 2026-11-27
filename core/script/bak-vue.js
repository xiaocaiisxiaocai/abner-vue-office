const fs = require('fs');
const path = require('path');

const type = process.argv[2];
if (type !== undefined && type !== 'bak' && type !== 'restore') {
    console.error(`[abner-vue-office] bak-vue.js expects "bak", "restore", or no argument, but got "${type}".`);
    process.exit(1);
}

const vuePath = path.resolve(__dirname, '../node_modules/vue');
const vueBakPath = path.resolve(__dirname, '../node_modules/vue-bak');

function entryExists(targetPath) {
    try {
        fs.lstatSync(targetPath);
        return true;
    } catch (err) {
        if (err && err.code === 'ENOENT') {
            return false;
        }
        throw err;
    }
}

function sleepSync(ms) {
    try {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    } catch (e) {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            // busy-wait fallback
        }
    }
}

function renameWithRetry(fromPath, toPath, retries = 5) {
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            fs.renameSync(fromPath, toPath);
            return;
        } catch (err) {
            lastErr = err;
            const retryable = err && (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES');
            if (!retryable || attempt === retries) {
                throw err;
            }
            sleepSync(50 * (attempt + 1));
        }
    }
    throw lastErr;
}

if (type === 'bak') {
    if (entryExists(vueBakPath) && entryExists(vuePath)) {
        fs.rmSync(vueBakPath, { recursive: true, force: true });
    }
    if (!entryExists(vueBakPath) && entryExists(vuePath)) {
        renameWithRetry(vuePath, vueBakPath);
    }
} else {
    if (!entryExists(vuePath) && entryExists(vueBakPath)) {
        renameWithRetry(vueBakPath, vuePath);
    } else if (entryExists(vuePath) && entryExists(vueBakPath)) {
        fs.rmSync(vueBakPath, { recursive: true, force: true });
    }
}
