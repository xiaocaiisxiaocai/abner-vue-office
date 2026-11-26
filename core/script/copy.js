const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0 || args.length % 2 !== 0) {
    console.error('[abner-vue-office] copy.js requires pairs of <src> <dest> arguments.');
    process.exit(1);
}

for (let i = 0; i < args.length; i += 2) {
    const srcPath = path.resolve(process.cwd(), args[i]);
    const destPath = path.resolve(process.cwd(), args[i + 1]);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
}
