import en from './en';

// Defines the fallback language as English
let $languages = ['en'];
const $messages = {
  en,
};

function translate(key, messages) {
  if (messages && key && typeof key === 'string') {
    // Splits the key at '.' except where escaped as '\.'
    const keys = key.match(/(?:\\.|[^.])+/g);
    if (!keys) return undefined;

    for (const lang of $languages) {
      if (!Object.prototype.hasOwnProperty.call(messages, lang) || !messages[lang]) continue;

      let message = messages[lang];

      for (let i = 0; i < keys.length; i += 1) {
        const property = keys[i].replace(/\\\./g, '.');
        if (!message || typeof message !== 'object' || !Object.prototype.hasOwnProperty.call(message, property)) {
          break;
        }
        const value = message[property];

        if (value === undefined) break;

        if (i === keys.length - 1) return value;

        message = value;
      }
    }
  }

  return undefined;
}

function t(key, ...args) {
  let v = translate(key, $messages);
  if (v === undefined && typeof window !== 'undefined' && window.x_spreadsheet && window.x_spreadsheet.$messages) {
    v = translate(key, window.x_spreadsheet.$messages);
  }
  if (typeof v === 'string' && args.length > 0) {
    let idx = 0;
    v = v.replace(/\{\}/g, () => (idx < args.length ? args[idx++] : '{}'));
  }
  return v !== undefined ? v : '';
}

function tf(key) {
  return () => t(key);
}

function locale(lang, message, clearLangList = false) {
  if (clearLangList) {
    $languages = [lang];
  } else {
    $languages = [lang, ...$languages.filter(l => l !== lang)];
  }

  if (message) {
    $messages[lang] = message;
  }
}

export default {
  t,
};

export {
  locale,
  t,
  tf,
};
