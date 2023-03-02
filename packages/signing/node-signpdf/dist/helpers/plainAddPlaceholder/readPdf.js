"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _readRefTable = _interopRequireDefault(require("./readRefTable"));

var _findObject = _interopRequireDefault(require("./findObject"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const getValue = (trailer, key) => {
  let index = trailer.indexOf(key);

  if (index === -1) {
    return undefined;
  }

  const slice = trailer.slice(index);
  index = slice.indexOf('/', 1);

  if (index === -1) {
    index = slice.indexOf('>', 1);
  }

  return slice.slice(key.length + 1, index).toString().trim(); // key + at least one space
};
/**
 * Simplified parsing of a PDF Buffer.
 * Extracts reference table, root info and trailer start.
 *
 * See section 7.5.5 (File Trailer) of the PDF specs.
 *
 * @param {Buffer} pdfBuffer
 */


const readPdf = pdfBuffer => {
  // Extract the trailer dictionary.
  const trailerStart = pdfBuffer.lastIndexOf('trailer'); // The trailer is followed by xref. Then an EOF. EOF's length is 6 characters.

  const trailer = pdfBuffer.slice(trailerStart, pdfBuffer.length - 6);
  let xRefPosition = trailer.slice(trailer.lastIndexOf('startxref') + 10).toString();
  xRefPosition = parseInt(xRefPosition);
  const refTable = (0, _readRefTable.default)(pdfBuffer);
  const rootRef = getValue(trailer, '/Root');
  const root = (0, _findObject.default)(pdfBuffer, refTable, rootRef).toString();
  const infoRef = getValue(trailer, '/Info');
  return {
    xref: refTable,
    rootRef,
    root,
    infoRef,
    trailerStart,
    previousXrefs: [],
    xRefPosition
  };
};

var _default = readPdf;
exports.default = _default;