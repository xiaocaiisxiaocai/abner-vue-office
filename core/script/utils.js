const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '../');

function loadModule(name) {
    if (name === 'vue') {
        const searchPaths = [__dirname, process.cwd()].filter(Boolean);
        try {
            const pkgPath = require.resolve('vue/package.json', { paths: searchPaths });
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (pkg && typeof pkg.version === 'string') {
                return { version: pkg.version };
            }
        } catch (e) {
            // fall through to standard require resolution
        }
        try {
            const modPath = require.resolve(name, { paths: searchPaths });
            return require(modPath);
        } catch (e) {
            return undefined;
        }
    }
    try {
        return require(name);
    } catch (e) {
        return undefined;
    }
}

function copy(name, version, { optional = false } = {}) {
    const src = path.join(dir, `v${version}`, name);
    const dest = path.join(dir, name);
    if (!fs.existsSync(src)) {
        if (optional) {
            return true;
        }
        console.warn(`[abner-vue-office] Missing build artifact: ${src}`);
        return false;
    }
    const tmpDest = `${dest}.${process.pid}.${Date.now()}.tmp`;
    try {
        fs.copyFileSync(src, tmpDest);
        fs.renameSync(tmpDest, dest);
    } catch (err) {
        try {
            if (fs.existsSync(tmpDest)) {
                fs.unlinkSync(tmpDest);
            }
        } catch (cleanupErr) {
            // ignore cleanup errors
        }
        throw err;
    }
    return true;
}

function switchVersion(version) {
    const okJs = copy('index.js', version, { optional: false });
    if (!okJs) {
        return false;
    }
    copy('index.mjs', version, { optional: true });
    copy('index.css', version, { optional: true });
    return true;
}

module.exports.loadModule = loadModule;
module.exports.switchVersion = switchVersion;
