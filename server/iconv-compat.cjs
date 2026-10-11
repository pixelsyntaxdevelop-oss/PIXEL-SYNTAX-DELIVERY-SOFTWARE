"use strict";

// Cloudflare Workers runtime compatible iconv-lite implementation
// Resolves: "Uncaught TypeError: require_streams(...) is not a function"
// Caused by iconv-lite/package.json "browser" mapping disabling ./lib/streams during bundling.

var Buffer = require("buffer").Buffer;

var iconv = module.exports;

iconv.encodings = null;
iconv.defaultCharUnicode = '';
iconv.defaultCharSingleByte = '?';

// Pure JS fallback codecs
var textEncoders = {};
var textDecoders = {};

function getNativeEncoder(encoding) {
  var enc = ('' + encoding).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!textEncoders[enc]) {
    try {
      textEncoders[enc] = new TextEncoder();
    } catch (e) {
      return null;
    }
  }
  return textEncoders[enc];
}

function getNativeDecoder(encoding) {
  var enc = ('' + encoding).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!textDecoders[enc]) {
    try {
      var label = encoding;
      if (enc === 'utf8' || enc === 'utf-8') label = 'utf-8';
      else if (enc === 'latin1' || enc === 'binary') label = 'latin1';
      else if (enc === 'ascii') label = 'windows-1252';
      textDecoders[enc] = new TextDecoder(label, { fatal: false });
    } catch (e) {
      return null;
    }
  }
  return textDecoders[enc];
}

iconv.encode = function encode(str, encoding, options) {
  str = '' + (str || '');
  var enc = ('' + (encoding || 'utf8')).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (enc === 'utf8' || enc === 'utf-8') {
    return Buffer.from(str, 'utf8');
  }
  if (enc === 'latin1' || enc === 'binary') {
    return Buffer.from(str, 'latin1');
  }
  if (enc === 'ascii') {
    return Buffer.from(str, 'ascii');
  }
  var encoder = getNativeEncoder(encoding);
  if (encoder) {
    return Buffer.from(encoder.encode(str));
  }
  return Buffer.from(str, 'utf8');
};

iconv.decode = function decode(buf, encoding, options) {
  if (typeof buf === 'string') {
    buf = Buffer.from('' + (buf || ''), 'binary');
  }
  if (!buf) return '';
  var enc = ('' + (encoding || 'utf8')).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (enc === 'utf8' || enc === 'utf-8') {
    return Buffer.isBuffer(buf) ? buf.toString('utf8') : new TextDecoder('utf-8').decode(buf);
  }
  if (enc === 'latin1' || enc === 'binary') {
    return Buffer.isBuffer(buf) ? buf.toString('latin1') : new TextDecoder('latin1').decode(buf);
  }
  if (enc === 'ascii') {
    return Buffer.isBuffer(buf) ? buf.toString('ascii') : new TextDecoder('windows-1252').decode(buf);
  }
  var decoder = getNativeDecoder(encoding);
  if (decoder) {
    return decoder.decode(buf);
  }
  return Buffer.isBuffer(buf) ? buf.toString('utf8') : new TextDecoder('utf-8').decode(buf);
};

iconv.encodingExists = function encodingExists(enc) {
  if (!enc) return false;
  var clean = ('' + enc).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['utf8', 'utf-8', 'latin1', 'binary', 'ascii', 'windows1252', 'iso88591', 'ucs2', 'utf16le'].includes(clean)) {
    return true;
  }
  try {
    new TextDecoder(enc);
    return true;
  } catch (e) {
    return false;
  }
};

iconv.toEncoding = iconv.encode;
iconv.fromEncoding = iconv.decode;

iconv.getEncoder = function getEncoder(encoding, options) {
  var enc = getNativeEncoder(encoding);
  return {
    write: function(str) {
      if (enc) return Buffer.from(enc.encode(str));
      return Buffer.from(str || '', 'utf8');
    },
    end: function() {
      return Buffer.alloc(0);
    }
  };
};

iconv.getDecoder = function getDecoder(encoding, options) {
  var dec = getNativeDecoder(encoding);
  return {
    write: function(buf) {
      if (!buf || buf.length === 0) return '';
      if (dec) {
        try {
          return dec.decode(buf, { stream: true });
        } catch {
          return Buffer.isBuffer(buf) ? buf.toString('utf8') : '';
        }
      }
      return Buffer.isBuffer(buf) ? buf.toString('utf8') : '';
    },
    end: function() {
      if (dec) {
        try {
          return dec.decode();
        } catch {
          return '';
        }
      }
      return '';
    }
  };
};

iconv.encodeStream = function encodeStream() {
  throw new Error('encodeStream is not supported in Cloudflare Worker runtime.');
};

iconv.decodeStream = function decodeStream() {
  throw new Error('decodeStream is not supported in Cloudflare Worker runtime.');
};

iconv.supportsStreams = false;
