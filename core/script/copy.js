const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0 || args.length % 2 !== 0) {
    console.error('[abner-vue-office] copy.js requires pairs of <src> <dest> arguments.');
    process.exit(1);
}

function isSamePath(a, b) {
    const na = path.resolve(a);
    const nb = path.resolve(b);
    return process.platform === 'win32' ? na.toLowerCase() === nb.toLowerCase() : na === nb;
}

for (let i = 0; i < args.length; i += 2) {
    const srcPath = path.resolve(process.cwd(), args[i]);
    const destPath = path.resolve(process.cwd(), args[i + 1]);
    let stat;
    try {
        stat = fs.statSync(srcPath);
    } catch (err) {
        console.error(`[abner-vue-office] Source file not found: ${srcPath}`);
        process.exit(1);
    }
    if (!stat.isFile()) {
        console.error(`[abner-vue-office] Source path is not a file: ${srcPath}`);
        process.exit(1);
    }
    if (isSamePath(srcPath, destPath)) {
        continue;
    }
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
}
