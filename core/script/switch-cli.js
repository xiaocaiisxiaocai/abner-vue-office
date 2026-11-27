#!/usr/bin/env node
const { switchVersion } = require('./utils');

const version = process.argv[2];

if (version === '2') {
    if (!switchVersion(2)) {
        process.exit(1);
    }
} else if (version === '3') {
    if (!switchVersion(3)) {
        process.exit(1);
    }
} else {
    console.warn(
        `[abner-vue-office] expecting version "2" or "3" but got "${version}"`
    );
    process.exit(1);
}
