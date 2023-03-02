"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _abstract_reference = _interopRequireDefault(require("./abstract_reference"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
PDFObject by Devon Govett used below.
The class is part of pdfkit. See https://github.com/foliojs/pdfkit
LICENSE: MIT. Included in this folder.
Modifications may have been applied for the purposes of node-signpdf.
*/

/*
PDFObject - converts JavaScript types into their corresponding PDF types.
By Devon Govett
*/
const pad = (str, length) => (Array(length + 1).join('0') + str).slice(-length);

const escapableRe = /[\n\r\t\b\f()\\]/g;
const escapable = {
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\b': '\\b',
  '\f': '\\f',
  '\\': '\\\\',
  '(': '\\(',
  ')': '\\)'
}; // Convert little endian UTF-16 to big endian

const swapBytes = buff => buff.swap16();

class PDFObject {
  static convert(object, encryptFn = null) {
    // String literals are converted to the PDF name type
    if (typeof object === 'string') {
      return `/${object}`; // String objects are converted to PDF strings (UTF-16)
    }

    if (object instanceof String) {
      let string = object; // Detect if this is a unicode string

      let isUnicode = false;

      for (let i = 0, end = string.length; i < end; i += 1) {
        if (string.charCodeAt(i) > 0x7f) {
          isUnicode = true;
          break;
        }
      } // If so, encode it as big endian UTF-16


      let stringBuffer;

      if (isUnicode) {
        stringBuffer = swapBytes(Buffer.from(`\ufeff${string}`, 'utf16le'));
      } else {
        stringBuffer = Buffer.from(string, 'ascii');
      } // Encrypt the string when necessary


      if (encryptFn) {
        string = encryptFn(stringBuffer).toString('binary');
      } else {
        string = stringBuffer.toString('binary');
      } // Escape characters as required by the spec


      string = string.replace(escapableRe, c => escapable[c]);
      return `(${string})`; // Buffers are converted to PDF hex strings
    }

    if (Buffer.isBuffer(object)) {
      return `<${object.toString('hex')}>`;
    }

    if (object instanceof _abstract_reference.default) {
      return object.toString();
    }

    if (object instanceof Date) {
      let string = `D:${pad(object.getUTCFullYear(), 4)}${pad(object.getUTCMonth() + 1, 2)}${pad(object.getUTCDate(), 2)}${pad(object.getUTCHours(), 2)}${pad(object.getUTCMinutes(), 2)}${pad(object.getUTCSeconds(), 2)}Z`; // Encrypt the string when necessary

      if (encryptFn) {
        string = encryptFn(Buffer.from(string, 'ascii')).toString('binary'); // Escape characters as required by the spec

        string = string.replace(escapableRe, c => escapable[c]);
      }

      return `(${string})`;
    }

    if (Array.isArray(object)) {
      const items = object.map(e => PDFObject.convert(e, encryptFn)).join(' ');
      return `[${items}]`;
    }

    if ({}.toString.call(object) === '[object Object]') {
      const out = ['<<'];
      let streamData; // @todo this can probably be refactored into a reduce

      Object.entries(object).forEach(([key, val]) => {
        let checkedValue = '';

        if (val.toString().indexOf('<<') !== -1) {
          checkedValue = val;
        } else {
          checkedValue = PDFObject.convert(val, encryptFn);
        }

        if (key === 'stream') {
          streamData = `${key}\n${val}\nendstream`;
        } else {
          out.push(`/${key} ${checkedValue}`);
        }
      });
      out.push('>>');

      if (streamData) {
        out.push(streamData);
      }

      return out.join('\n');
    }

    if (typeof object === 'number') {
      return PDFObject.number(object);
    }

    return `${object}`;
  }

  static number(n) {
    if (n > -1e21 && n < 1e21) {
      return Math.round(n * 1e6) / 1e6;
    }

    throw new Error(`unsupported number: ${n}`);
  }

}

exports.default = PDFObject;