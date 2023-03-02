"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _SignPdfError = _interopRequireDefault(require("../../SignPdfError"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const xrefToRefMap = xrefString => {
  const lines = xrefString.split('\n').filter(l => l !== '');
  let index = 0;
  let expectedLines = 0;
  const xref = new Map();
  lines.forEach(line => {
    const split = line.split(' ');

    if (split.length === 2) {
      index = parseInt(split[0]);
      expectedLines = parseInt(split[1]);
      return;
    }

    if (expectedLines <= 0) {
      throw new _SignPdfError.default('Too many lines in xref table.', _SignPdfError.default.TYPE_PARSE);
    }

    expectedLines -= 1;
    const [offset,, inUse] = split;

    if (inUse.trim() === 'f') {
      index += 1;
      return;
    }

    if (inUse.trim() !== 'n') {
      throw new _SignPdfError.default(`Unknown in-use flag "${inUse}". Expected "n" or "f".`, _SignPdfError.default.TYPE_PARSE);
    }

    if (!/^\d+$/.test(offset.trim())) {
      throw new _SignPdfError.default(`Expected integer offset. Got "${offset}".`, _SignPdfError.default.TYPE_PARSE);
    }

    const storeOffset = parseInt(offset.trim());
    xref.set(index, storeOffset);
    index += 1;
  });
  return xref;
};

var _default = xrefToRefMap;
exports.default = _default;