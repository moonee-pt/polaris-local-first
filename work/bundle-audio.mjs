var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/@capacitor/core/dist/index.cjs.js
var require_index_cjs = __commonJS({
  "node_modules/@capacitor/core/dist/index.cjs.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ExceptionCode = void 0;
    (function(ExceptionCode) {
      ExceptionCode["Unimplemented"] = "UNIMPLEMENTED";
      ExceptionCode["Unavailable"] = "UNAVAILABLE";
    })(exports.ExceptionCode || (exports.ExceptionCode = {}));
    var CapacitorException = class extends Error {
      constructor(message, code, data) {
        super(message);
        this.message = message;
        this.code = code;
        this.data = data;
      }
    };
    var getPlatformId = (win) => {
      var _a, _b;
      if (win === null || win === void 0 ? void 0 : win.androidBridge) {
        return "android";
      } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
        return "ios";
      } else {
        return "web";
      }
    };
    var createCapacitor = (win) => {
      const capCustomPlatform = win.CapacitorCustomPlatform || null;
      const cap = win.Capacitor || {};
      const Plugins = cap.Plugins = cap.Plugins || {};
      const getPlatform = () => {
        return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
      };
      const isNativePlatform = () => getPlatform() !== "web";
      const isPluginAvailable = (pluginName) => {
        const plugin = registeredPlugins.get(pluginName);
        if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
          return true;
        }
        if (getPluginHeader(pluginName)) {
          return true;
        }
        return false;
      };
      const getPluginHeader = (pluginName) => {
        var _a;
        return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
      };
      const handleError = (err) => win.console.error(err);
      const registeredPlugins = /* @__PURE__ */ new Map();
      const registerPlugin2 = (pluginName, jsImplementations = {}) => {
        const registeredPlugin = registeredPlugins.get(pluginName);
        if (registeredPlugin) {
          console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
          return registeredPlugin.proxy;
        }
        const platform = getPlatform();
        const pluginHeader = getPluginHeader(pluginName);
        let jsImplementation;
        const loadPluginImplementation = async () => {
          if (!jsImplementation && platform in jsImplementations) {
            jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
          } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
            jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
          }
          return jsImplementation;
        };
        const createPluginMethod = (impl, prop) => {
          var _a, _b;
          if (pluginHeader) {
            const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
            if (methodHeader) {
              if (methodHeader.rtype === "promise") {
                return (options) => cap.nativePromise(pluginName, prop.toString(), options);
              } else {
                return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
              }
            } else if (impl) {
              return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
            }
          } else if (impl) {
            return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
          } else {
            throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, exports.ExceptionCode.Unimplemented);
          }
        };
        const createPluginMethodWrapper = (prop) => {
          let remove;
          const wrapper = (...args) => {
            const p = loadPluginImplementation().then((impl) => {
              const fn = createPluginMethod(impl, prop);
              if (fn) {
                const p2 = fn(...args);
                remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                return p2;
              } else {
                throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, exports.ExceptionCode.Unimplemented);
              }
            });
            if (prop === "addListener") {
              p.remove = async () => remove();
            }
            return p;
          };
          wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
          Object.defineProperty(wrapper, "name", {
            value: prop,
            writable: false,
            configurable: false
          });
          return wrapper;
        };
        const addListener = createPluginMethodWrapper("addListener");
        const removeListener = createPluginMethodWrapper("removeListener");
        const addListenerNative = (eventName, callback) => {
          const call = addListener({ eventName }, callback);
          const remove = async () => {
            const callbackId = await call;
            removeListener({
              eventName,
              callbackId
            }, callback);
          };
          const p = new Promise((resolve) => call.then(() => resolve({ remove })));
          p.remove = async () => {
            console.warn(`Using addListener() without 'await' is deprecated.`);
            await remove();
          };
          return p;
        };
        const proxy = new Proxy({}, {
          get(_, prop) {
            switch (prop) {
              case "$$typeof":
                return void 0;
              case "toJSON":
                return () => ({});
              case "addListener":
                return pluginHeader ? addListenerNative : addListener;
              case "removeListener":
                return removeListener;
              default:
                return createPluginMethodWrapper(prop);
            }
          }
        });
        Plugins[pluginName] = proxy;
        registeredPlugins.set(pluginName, {
          name: pluginName,
          proxy,
          platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
        });
        return proxy;
      };
      if (!cap.convertFileSrc) {
        cap.convertFileSrc = (filePath) => filePath;
      }
      cap.getPlatform = getPlatform;
      cap.handleError = handleError;
      cap.isNativePlatform = isNativePlatform;
      cap.isPluginAvailable = isPluginAvailable;
      cap.registerPlugin = registerPlugin2;
      cap.Exception = CapacitorException;
      cap.DEBUG = !!cap.DEBUG;
      cap.isLoggingEnabled = !!cap.isLoggingEnabled;
      return cap;
    };
    var initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
    var Capacitor2 = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
    var registerPlugin = Capacitor2.registerPlugin;
    var WebPlugin = class {
      constructor() {
        this.listeners = {};
        this.retainedEventArguments = {};
        this.windowListeners = {};
      }
      addListener(eventName, listenerFunc) {
        let firstListener = false;
        const listeners = this.listeners[eventName];
        if (!listeners) {
          this.listeners[eventName] = [];
          firstListener = true;
        }
        this.listeners[eventName].push(listenerFunc);
        const windowListener = this.windowListeners[eventName];
        if (windowListener && !windowListener.registered) {
          this.addWindowListener(windowListener);
        }
        if (firstListener) {
          this.sendRetainedArgumentsForEvent(eventName);
        }
        const remove = async () => this.removeListener(eventName, listenerFunc);
        const p = Promise.resolve({ remove });
        return p;
      }
      async removeAllListeners() {
        this.listeners = {};
        for (const listener in this.windowListeners) {
          this.removeWindowListener(this.windowListeners[listener]);
        }
        this.windowListeners = {};
      }
      notifyListeners(eventName, data, retainUntilConsumed) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          if (retainUntilConsumed) {
            let args = this.retainedEventArguments[eventName];
            if (!args) {
              args = [];
            }
            args.push(data);
            this.retainedEventArguments[eventName] = args;
          }
          return;
        }
        listeners.forEach((listener) => listener(data));
      }
      hasListeners(eventName) {
        var _a;
        return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
      }
      registerWindowListener(windowEventName, pluginEventName) {
        this.windowListeners[pluginEventName] = {
          registered: false,
          windowEventName,
          pluginEventName,
          handler: (event) => {
            this.notifyListeners(pluginEventName, event);
          }
        };
      }
      unimplemented(msg = "not implemented") {
        return new Capacitor2.Exception(msg, exports.ExceptionCode.Unimplemented);
      }
      unavailable(msg = "not available") {
        return new Capacitor2.Exception(msg, exports.ExceptionCode.Unavailable);
      }
      async removeListener(eventName, listenerFunc) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          return;
        }
        const index = listeners.indexOf(listenerFunc);
        this.listeners[eventName].splice(index, 1);
        if (!this.listeners[eventName].length) {
          this.removeWindowListener(this.windowListeners[eventName]);
        }
      }
      addWindowListener(handle) {
        window.addEventListener(handle.windowEventName, handle.handler);
        handle.registered = true;
      }
      removeWindowListener(handle) {
        if (!handle) {
          return;
        }
        window.removeEventListener(handle.windowEventName, handle.handler);
        handle.registered = false;
      }
      sendRetainedArgumentsForEvent(eventName) {
        const args = this.retainedEventArguments[eventName];
        if (!args) {
          return;
        }
        delete this.retainedEventArguments[eventName];
        args.forEach((arg) => {
          this.notifyListeners(eventName, arg);
        });
      }
    };
    var WebView = /* @__PURE__ */ registerPlugin("WebView");
    var encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
    var decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
    var CapacitorCookiesPluginWeb = class extends WebPlugin {
      async getCookies() {
        const cookies = document.cookie;
        const cookieMap = {};
        cookies.split(";").forEach((cookie) => {
          if (cookie.length <= 0)
            return;
          let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
          key = decode(key).trim();
          value = decode(value).trim();
          cookieMap[key] = value;
        });
        return cookieMap;
      }
      async setCookie(options) {
        try {
          const encodedKey = encode(options.key);
          const encodedValue = encode(options.value);
          const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
          const path = (options.path || "/").replace("path=", "");
          const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
          document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async deleteCookie(options) {
        try {
          document.cookie = `${options.key}=; Max-Age=0`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearCookies() {
        try {
          const cookies = document.cookie.split(";") || [];
          for (const cookie of cookies) {
            document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
          }
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearAllCookies() {
        try {
          await this.clearCookies();
        } catch (error) {
          return Promise.reject(error);
        }
      }
    };
    var CapacitorCookies = registerPlugin("CapacitorCookies", {
      web: () => new CapacitorCookiesPluginWeb()
    });
    var readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result;
        resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });
    var normalizeHttpHeaders = (headers = {}) => {
      const originalKeys = Object.keys(headers);
      const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
      const normalized = loweredKeys.reduce((acc, key, index) => {
        acc[key] = headers[originalKeys[index]];
        return acc;
      }, {});
      return normalized;
    };
    var buildUrlParams = (params, shouldEncode = true) => {
      if (!params)
        return null;
      const output = Object.entries(params).reduce((accumulator, entry) => {
        const [key, value] = entry;
        let encodedValue;
        let item;
        if (Array.isArray(value)) {
          item = "";
          value.forEach((str) => {
            encodedValue = shouldEncode ? encodeURIComponent(str) : str;
            item += `${key}=${encodedValue}&`;
          });
          item.slice(0, -1);
        } else {
          encodedValue = shouldEncode ? encodeURIComponent(value) : value;
          item = `${key}=${encodedValue}`;
        }
        return `${accumulator}&${item}`;
      }, "");
      return output.substr(1);
    };
    var buildRequestInit = (options, extra = {}) => {
      const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
      const headers = normalizeHttpHeaders(options.headers);
      const type = headers["content-type"] || "";
      if (typeof options.data === "string") {
        output.body = options.data;
      } else if (type.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.data || {})) {
          params.set(key, value);
        }
        output.body = params.toString();
      } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
        const form = new FormData();
        if (options.data instanceof FormData) {
          options.data.forEach((value, key) => {
            form.append(key, value);
          });
        } else {
          for (const key of Object.keys(options.data)) {
            form.append(key, options.data[key]);
          }
        }
        output.body = form;
        const headers2 = new Headers(output.headers);
        headers2.delete("content-type");
        output.headers = headers2;
      } else if (type.includes("application/json") || typeof options.data === "object") {
        output.body = JSON.stringify(options.data);
      }
      return output;
    };
    var CapacitorHttpPluginWeb = class extends WebPlugin {
      /**
       * Perform an Http request given a set of options
       * @param options Options to build the HTTP request
       */
      async request(options) {
        const requestInit = buildRequestInit(options, options.webFetchExtra);
        const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
        const url = urlParams ? `${options.url}?${urlParams}` : options.url;
        const response = await fetch(url, requestInit);
        const contentType = response.headers.get("content-type") || "";
        let { responseType = "text" } = response.ok ? options : {};
        if (contentType.includes("application/json")) {
          responseType = "json";
        }
        let data;
        let blob;
        switch (responseType) {
          case "arraybuffer":
          case "blob":
            blob = await response.blob();
            data = await readBlobAsBase64(blob);
            break;
          case "json":
            data = await response.json();
            break;
          case "document":
          case "text":
          default:
            data = await response.text();
        }
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return {
          data,
          headers,
          status: response.status,
          url: response.url
        };
      }
      /**
       * Perform an Http GET request given a set of options
       * @param options Options to build the HTTP request
       */
      async get(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
      }
      /**
       * Perform an Http POST request given a set of options
       * @param options Options to build the HTTP request
       */
      async post(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
      }
      /**
       * Perform an Http PUT request given a set of options
       * @param options Options to build the HTTP request
       */
      async put(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
      }
      /**
       * Perform an Http PATCH request given a set of options
       * @param options Options to build the HTTP request
       */
      async patch(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
      }
      /**
       * Perform an Http DELETE request given a set of options
       * @param options Options to build the HTTP request
       */
      async delete(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
      }
    };
    var CapacitorHttp = registerPlugin("CapacitorHttp", {
      web: () => new CapacitorHttpPluginWeb()
    });
    exports.SystemBarsStyle = void 0;
    (function(SystemBarsStyle) {
      SystemBarsStyle["Dark"] = "DARK";
      SystemBarsStyle["Light"] = "LIGHT";
      SystemBarsStyle["Default"] = "DEFAULT";
    })(exports.SystemBarsStyle || (exports.SystemBarsStyle = {}));
    exports.SystemBarType = void 0;
    (function(SystemBarType) {
      SystemBarType["StatusBar"] = "StatusBar";
      SystemBarType["NavigationBar"] = "NavigationBar";
    })(exports.SystemBarType || (exports.SystemBarType = {}));
    var SystemBarsPluginWeb = class extends WebPlugin {
      async setStyle() {
        this.unavailable("not available for web");
      }
      async setAnimation() {
        this.unavailable("not available for web");
      }
      async show() {
        this.unavailable("not available for web");
      }
      async hide() {
        this.unavailable("not available for web");
      }
    };
    var SystemBars = registerPlugin("SystemBars", {
      web: () => new SystemBarsPluginWeb()
    });
    exports.Capacitor = Capacitor2;
    exports.CapacitorCookies = CapacitorCookies;
    exports.CapacitorException = CapacitorException;
    exports.CapacitorHttp = CapacitorHttp;
    exports.SystemBars = SystemBars;
    exports.WebPlugin = WebPlugin;
    exports.WebView = WebView;
    exports.buildRequestInit = buildRequestInit;
    exports.registerPlugin = registerPlugin;
  }
});

// api/provider-audio.ts
import { once } from "node:events";

// src/engines/chat-api/providerRelayShared.ts
var FORBIDDEN_RELAY_HEADER_NAMES = /* @__PURE__ */ new Set([
  "connection",
  "content-length",
  "host",
  "origin",
  "referer",
  "transfer-encoding"
]);
var PROVIDER_RELAY_AUTH_HEADER_NAMES = /* @__PURE__ */ new Set([
  "authorization",
  "x-api-key",
  "x-goog-api-key",
  "xi-api-key"
]);
function isPrivateHostname(hostname) {
  const lower = hostname.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (!lower) return true;
  if (lower === "localhost" || lower.endsWith(".local")) return true;
  const mappedIpv4 = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) return isPrivateHostname(mappedIpv4[1]);
  const mappedIpv4Hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedIpv4Hex) {
    const high = parseInt(mappedIpv4Hex[1], 16);
    const low = parseInt(mappedIpv4Hex[2], 16);
    return isPrivateHostname([high >> 8, high & 255, low >> 8, low & 255].join("."));
  }
  if (lower === "::" || lower === "::1") return true;
  if (lower.includes(":") && (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:"))) {
    return true;
  }
  const ipv4 = lower.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
  }
  return false;
}
function sanitizeProviderRelayHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).filter(([rawKey, value]) => {
      if (typeof value !== "string" || !value.trim()) return false;
      const key = rawKey.trim().toLowerCase();
      if (!key) return false;
      if (FORBIDDEN_RELAY_HEADER_NAMES.has(key)) return false;
      if (key.startsWith("x-forwarded-")) return false;
      return true;
    })
  );
}
function hasProviderRelayAuthHeader(headers) {
  return Object.keys(headers).some((key) => PROVIDER_RELAY_AUTH_HEADER_NAMES.has(key.trim().toLowerCase()));
}

// src/engines/chat-api/providerAudioRelayShared.ts
function normalizeAudioPath(pathname) {
  return pathname.replace(/\/+$/, "").toLowerCase();
}
function isElevenLabsTextToSpeechPath(pathname) {
  const normalizedPath = normalizeAudioPath(pathname);
  return /^\/v\d+\/text-to-speech\/[^/]+$/.test(normalizedPath);
}
function isMiniMaxVoiceManagementPath(pathname) {
  const normalizedPath = normalizeAudioPath(pathname);
  return normalizedPath.endsWith("/get_voice") || normalizedPath.endsWith("/voice_design");
}
function isFishAudioTextToSpeechPath(pathname) {
  return normalizeAudioPath(pathname).endsWith("/tts");
}
function isProviderAudioRelayTarget(endpoint) {
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (isPrivateHostname(parsed.hostname)) return false;
  const normalizedPath = normalizeAudioPath(parsed.pathname);
  return normalizedPath.endsWith("/audio/speech") || normalizedPath.endsWith("/t2a_v2") || isMiniMaxVoiceManagementPath(parsed.pathname) || isElevenLabsTextToSpeechPath(parsed.pathname) || isFishAudioTextToSpeechPath(parsed.pathname);
}
function isOpenAiAudioSpeechRequestBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value;
  if (typeof record.model !== "string" || !record.model.trim()) return false;
  if (typeof record.input !== "string" || !record.input.trim()) return false;
  if (typeof record.voice !== "string" || !record.voice.trim()) return false;
  if (record.response_format !== void 0 && (typeof record.response_format !== "string" || !record.response_format.trim())) return false;
  return true;
}
function isMiniMaxAudioRequestBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value;
  const voiceSetting = record.voice_setting;
  const audioSetting = record.audio_setting;
  if (typeof record.model !== "string" || !record.model.trim()) return false;
  if (typeof record.text !== "string" || !record.text.trim()) return false;
  if (record.stream !== false) return false;
  if (record.output_format !== "hex") return false;
  if (!voiceSetting || typeof voiceSetting !== "object" || Array.isArray(voiceSetting)) return false;
  const voiceSettingRecord = voiceSetting;
  const voiceId = voiceSettingRecord.voice_id;
  if (typeof voiceId !== "string" || !voiceId.trim()) return false;
  if (!audioSetting || typeof audioSetting !== "object" || Array.isArray(audioSetting)) return false;
  const audioSettingRecord = audioSetting;
  const format = audioSettingRecord.format;
  if (typeof format !== "string" || !format.trim()) return false;
  return true;
}
function isMiniMaxVoiceListRequestBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value;
  return record.voice_type === "system" || record.voice_type === "voice_cloning" || record.voice_type === "voice_generation" || record.voice_type === "all";
}
function isMiniMaxVoiceDesignRequestBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value;
  if (typeof record.prompt !== "string" || !record.prompt.trim()) return false;
  if (typeof record.preview_text !== "string" || !record.preview_text.trim()) return false;
  if (record.preview_text.length > 500) return false;
  if (record.voice_id !== void 0 && (typeof record.voice_id !== "string" || !record.voice_id.trim())) return false;
  return true;
}
function isElevenLabsAudioRequestBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value;
  if (record.input !== void 0 || record.voice !== void 0 || record.stream !== void 0 || record.output_format !== void 0 || record.voice_setting !== void 0 || record.audio_setting !== void 0) {
    return false;
  }
  if (typeof record.text !== "string" || !record.text.trim()) return false;
  if (record.model_id !== void 0 && (typeof record.model_id !== "string" || !record.model_id.trim())) return false;
  return true;
}
function isFishAudioRequestBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value;
  const allowedKeys = /* @__PURE__ */ new Set(["text", "reference_id", "format", "normalize"]);
  if (Object.keys(record).some((key) => !allowedKeys.has(key))) return false;
  if (typeof record.text !== "string" || !record.text.trim()) return false;
  if (record.reference_id !== void 0 && (typeof record.reference_id !== "string" || !record.reference_id.trim())) return false;
  if (record.format !== void 0 && !["mp3", "opus", "wav", "pcm"].includes(String(record.format))) return false;
  if (record.normalize !== void 0 && typeof record.normalize !== "boolean") return false;
  return true;
}
function isProviderAudioRelayRequestBody(value) {
  return isOpenAiAudioSpeechRequestBody(value) || isMiniMaxAudioRequestBody(value) || isMiniMaxVoiceListRequestBody(value) || isMiniMaxVoiceDesignRequestBody(value) || isElevenLabsAudioRequestBody(value) || isFishAudioRequestBody(value);
}

// src/engines/chat-api/providerRelay.ts
var import_core = __toESM(require_index_cjs(), 1);

// src/engines/server/corsOrigin.ts
var POLARIS_API_ALLOWED_ORIGINS = /* @__PURE__ */ new Set([
  "capacitor://localhost",
  "polaris://app",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
  "http://localhost:5173",
  "http://127.0.0.1",
  "https://127.0.0.1",
  "http://127.0.0.1:5173",
  "https://127.0.0.1:5173"
]);
function isAllowedPolarisApiOrigin(origin) {
  if (POLARIS_API_ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/[\w-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
}

// server/providerAudioRelayTarget.ts
import { lookup } from "node:dns/promises";
var ProviderAudioRelayTargetError = class extends Error {
  constructor(message = "\u8BED\u97F3 relay \u53EA\u63A5\u53D7\u516C\u5F00 HTTPS \u7684\u8BED\u97F3\u751F\u6210\u3001MiniMax \u97F3\u8272\u7BA1\u7406\u3001FishAudio /tts \u6216 /text-to-speech/{voice_id} \u63A5\u53E3\u3002") {
    super(message);
    this.name = "ProviderAudioRelayTargetError";
  }
};
function normalizeAddress(value) {
  return value.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}
function isPrivateRelayAddress(address) {
  return isPrivateHostname(normalizeAddress(address));
}
async function resolveRelayAddresses(hostname) {
  try {
    return await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ProviderAudioRelayTargetError("\u8BED\u97F3 relay \u76EE\u6807\u57DF\u540D\u65E0\u6CD5\u89E3\u6790\u3002");
  }
}
async function validateProviderAudioRelayTarget(endpoint, options = {}) {
  if (!isProviderAudioRelayTarget(endpoint)) {
    throw new ProviderAudioRelayTargetError();
  }
  const parsed = new URL(endpoint);
  const hostname = normalizeAddress(parsed.hostname);
  if (isPrivateRelayAddress(hostname)) {
    throw new ProviderAudioRelayTargetError("\u8BED\u97F3 relay \u76EE\u6807\u4E0D\u80FD\u662F\u672C\u5730\u6216\u5185\u7F51\u5730\u5740\u3002");
  }
  const lookupAddress = options.lookupAddress ?? resolveRelayAddresses;
  const addresses = await lookupAddress(hostname);
  if (!addresses.length || addresses.some((record) => isPrivateRelayAddress(record.address))) {
    throw new ProviderAudioRelayTargetError("\u8BED\u97F3 relay \u76EE\u6807\u89E3\u6790\u5230\u4E86\u672C\u5730\u6216\u5185\u7F51\u5730\u5740\u3002");
  }
  return endpoint;
}

// api/provider-audio.ts
function applyCors(req, res) {
  const origin = req.headers.origin || "";
  if (isAllowedPolarisApiOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}
function parseRelayBody(req) {
  return typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
}
function sendAudioFailure(res, error) {
  if (res.headersSent || res.writableEnded) {
    res.end();
    return;
  }
  if (error instanceof ProviderAudioRelayTargetError) {
    res.status(400).json({ error: { message: error.message, type: "invalid_upstream" } });
    return;
  }
  res.status(502).json({ error: { message: "\u8BED\u97F3 relay \u8BF7\u6C42\u5931\u8D25\u3002", type: "relay_error" } });
}
async function pipeUpstreamBody(body, res) {
  const responseWithFlush = res;
  responseWithFlush.flushHeaders?.();
  const reader = body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value?.length) continue;
    if (!res.write(Buffer.from(value))) {
      await once(res, "drain");
    }
  }
  res.end();
}
async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed", type: "invalid_request" } });
    return;
  }
  try {
    const payload = parseRelayBody(req);
    const endpoint = typeof payload.endpoint === "string" ? payload.endpoint.trim() : "";
    await validateProviderAudioRelayTarget(endpoint);
    if (!isProviderAudioRelayRequestBody(payload.body)) {
      res.status(400).json({
        error: {
          message: "\u8BED\u97F3 relay \u8BF7\u6C42\u4F53\u5FC5\u987B\u662F\u53D7\u652F\u6301\u7684\u8BED\u97F3\u751F\u6210\u6216\u97F3\u8272\u7BA1\u7406\u8BF7\u6C42\u3002",
          type: "invalid_request"
        }
      });
      return;
    }
    const relayHeaders = sanitizeProviderRelayHeaders(
      payload.headers && typeof payload.headers === "object" && !Array.isArray(payload.headers) ? Object.fromEntries(
        Object.entries(payload.headers).map(([key, value]) => [key, String(value)])
      ) : {}
    );
    if (!hasProviderRelayAuthHeader(relayHeaders)) {
      res.status(400).json({
        error: {
          message: "\u8BED\u97F3 relay \u8BF7\u6C42\u7F3A\u5C11\u4E0A\u6E38\u8BA4\u8BC1\u5934\u3002",
          type: "missing_upstream_auth"
        }
      });
      return;
    }
    const upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers: relayHeaders,
      body: JSON.stringify(payload.body)
    });
    res.status(upstreamResponse.status);
    res.setHeader("Cache-Control", "no-store, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    const contentType = upstreamResponse.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    if (!upstreamResponse.body) {
      res.send(await upstreamResponse.arrayBuffer());
      return;
    }
    await pipeUpstreamBody(upstreamResponse.body, res);
  } catch (error) {
    sendAudioFailure(res, error);
  }
}
export {
  handler as default
};
/*! Bundled license information:

@capacitor/core/dist/index.cjs.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
