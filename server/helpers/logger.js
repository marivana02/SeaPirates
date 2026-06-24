const isDev = process.env.NODE_ENV !== 'production';

module.exports = {
  log: (...args) => { if (isDev) console.log(...args); },
  error: (...args) => { if (isDev) console.error(...args); },
  warn: (...args) => { if (isDev) console.warn(...args); },
  info: (...args) => { if (isDev) console.info(...args); },
  always: {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  }
};
