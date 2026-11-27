function HexToRgb(str) {
    if (!str || typeof str !== 'string') {
        return [0, 0, 0];
    }
    let hex = str.trim();
    if (hex.startsWith('#')) {
        hex = hex.slice(1);
    }
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
        hex = hex.split('').map(c => c + c).join('');
    }
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
        return [0, 0, 0];
    }
    return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
    ];
}

function RgbToHex(a, b, c) {
    const channels = [a, b, c].map(val => {
        const clamped = Math.max(0, Math.min(255, Math.round(val || 0)));
        const hex = clamped.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    });
    return '#' + channels.join('');
}

function clampLevel(level) {
    if (typeof level !== 'number' || !Number.isFinite(level)) {
        return 0;
    }
    return Math.max(0, Math.min(1, level));
}

export function getDarkColor(color, level) {
    const lv = clampLevel(level);
    const rgbc = HexToRgb(color);
    for (let i = 0; i < 3; i++) {
        rgbc[i] = Math.max(0, Math.min(255, Math.floor(rgbc[i] * (1 - lv))));
    }
    return RgbToHex(rgbc[0], rgbc[1], rgbc[2]);
}

export function getLightColor(color, level) {
    const lv = clampLevel(level);
    const rgbc = HexToRgb(color);
    for (let i = 0; i < 3; i++) {
        rgbc[i] = Math.max(0, Math.min(255, Math.floor((255 - rgbc[i]) * lv + rgbc[i])));
    }
    return RgbToHex(rgbc[0], rgbc[1], rgbc[2]);
}