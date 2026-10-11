declare const __APP_VERSION__: string | undefined;

// Replaced at build time from package.json; tests run without the bundler.
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
