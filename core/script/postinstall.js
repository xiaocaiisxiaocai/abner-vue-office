const { switchVersion, loadModule } = require('./utils');
const Vue = loadModule('vue');

function trySwitch(version) {
    try {
        switchVersion(version);
    } catch (err) {
        console.warn(
            `[abner-vue-office] Failed to switch build to Vue ${version}: ${err && err.message ? err.message : err}. ` +
            `You can import "@abner-vue-office/<pkg>/lib/v${version}" directly.`
        );
    }
}

if (!Vue || typeof Vue.version !== 'string') {
    console.warn(
        '[abner-vue-office] Vue is not found. Please run "npm install vue" to install.'
    );
} else if (Vue.version.startsWith('2.')) {
    trySwitch(2);
} else if (Vue.version.startsWith('3.')) {
    trySwitch(3);
} else {
    console.warn(
        `[abner-vue-office] Vue version v${Vue.version} is not supported.`
    );
}
