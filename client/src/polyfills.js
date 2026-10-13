// Polyfills for browser compatibility
// NOTE: Use only browser-native checks — NO require() calls (breaks ESM/Vite build)

// Object.assign polyfill (IE11)
if (typeof Object.assign !== 'function') {
  Object.assign = function(target) {
    'use strict';
    if (target == null) {
      throw new TypeError('Cannot convert undefined or null to object');
    }
    var to = Object(target);
    for (var index = 1; index < arguments.length; index++) {
      var nextSource = arguments[index];
      if (nextSource != null) {
        for (var nextKey in nextSource) {
          if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
    }
    return to;
  };
}

// Promise and fetch are available in all supported browsers (Chrome 40+, Edge 14+, Safari 10+)
// Do NOT use require() for polyfills — it is not defined in browser ESM bundles
