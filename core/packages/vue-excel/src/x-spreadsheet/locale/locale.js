import en from './en';

// Defines the fallback language as English
let $languages = ['en'];
const $messages = {
  en,
};

function translateFromLang(keys, messages, lang) {
  if (!messages || !Object.prototype.hasOwnProperty.call(messages, lang) || !messages[lang]) {
    return undefined;
  }
  let message = messages[lang];
  for (let i = 0; i < keys.length; i += 1) {
    const property = keys[i].replace(/\\\./g, '.');
    if (!message || typeof message !== 'object' || !Object.prototype.hasOwnProperty.call(message, property)) {
      return undefined;
    }
    const value = message[property];
    if (value === undefined) return undefined;
    if (i === keys.length - 1) return value;
    message = value;
  }
  return undefined;
}

function translate(key, messages, globalMessages) {
  if (key && typeof key === 'string') {
    // Splits the key at '.' except where escaped as '\.'
    const keys = key.match(/(?:\\.|[^.])+/g);
    if (!keys) return undefined;

    for (const lang of $languages) {
      let val = translateFromLang(keys, messages, lang);
      if (val !== undefined) return val;
      if (globalMessages) {
        val = translateFromLang(keys, globalMessages, lang);
        if (val !== undefined) return val;
      }
    }
  }

  return undefined;
}

function t(key, ...args) {
  const globalMessages = (typeof window !== 'undefined' && window.x_spreadsheet && window.x_spreadsheet.$messages)
    ? window.x_spreadsheet.$messages
    : null;
  let v = translate(key, $messages, globalMessages);
  if (typeof v === 'string' && args.length > 0) {
    let idx = 0;
    v = v.replace(/\{\}/g, () => {
      if (idx >= args.length) return '{}';
      const arg = args[idx++];
      return arg == null ? '' : String(arg);
    });
  }
  return v !== undefined ? v : '';
}

function tf(key) {
  return () => t(key);
}

function locale(lang, message, clearLangList = false) {
  if (typeof lang !== 'string' || !lang || lang === '__proto__' || lang === 'constructor' || lang === 'prototype') {
    return;
  }
  if (clearLangList) {
    $languages = [lang];
  } else {
    $languages = [lang, ...$languages.filter(l => l !== lang)];
  }

  if (message && typeof message === 'object') {
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
