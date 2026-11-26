function HexToRgb(str) {
    if (!str || typeof str !== 'string') {
        return [0, 0, 0];
    }
    let hex = str.replace('#', '').trim();
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    const hxs = hex.match(/[0-9a-fA-F]{2}/g);
    if (!hxs || hxs.length < 3) {
        return [0, 0, 0];
    }
    return [parseInt(hxs[0], 16), parseInt(hxs[1], 16), parseInt(hxs[2], 16)];
}

function RgbToHex(a, b, c) {
    const channels = [a, b, c].map(val => {
        const clamped = Math.max(0, Math.min(255, Math.round(val || 0)));
        const hex = clamped.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    });
    return '#' + channels.join('');
}

export function getDarkColor(color, level) {
    const rgbc = HexToRgb(color);
    for (let i = 0; i < 3; i++) {
        rgbc[i] = Math.max(0, Math.min(255, Math.floor(rgbc[i] * (1 - level))));
    }
    return RgbToHex(rgbc[0], rgbc[1], rgbc[2]);
}

export function getLightColor(color, level) {
    const rgbc = HexToRgb(color);
    for (let i = 0; i < 3; i++) {
        rgbc[i] = Math.max(0, Math.min(255, Math.floor((255 - rgbc[i]) * level + rgbc[i])));
    }
    return RgbToHex(rgbc[0], rgbc[1], rgbc[2]);
}