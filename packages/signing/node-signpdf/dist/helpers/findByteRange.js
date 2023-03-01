"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _SignPdfError = _interopRequireDefault(require("../SignPdfError"));

var _const = require("./const");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Finds ByteRange information within a given PDF Buffer if one exists
 *
 * @param {Buffer} pdf
 * @returns {Object} {byteRangePlaceholder: String, byteRangeStrings: String[], byteRange: String[]}
 */
const findByteRange = pdf => {
  if (!(pdf instanceof Buffer)) {
    throw new _SignPdfError.default('PDF expected as Buffer.', _SignPdfError.default.TYPE_INPUT);
  }

  const byteRangeStrings = pdf.toString().match(/\/ByteRange\s*\[{1}\s*(?:(?:\d*|\/\*{10})\s+){3}(?:\d+|\/\*{10}){1}\s*]{1}/g);

  if (!byteRangeStrings) {
    throw new _SignPdfError.default('No ByteRangeStrings found within PDF buffer', _SignPdfError.default.TYPE_PARSE);
  }

  const byteRangePlaceholder = byteRangeStrings.find(s => s.includes(`/${_const.DEFAULT_BYTE_RANGE_PLACEHOLDER}`));
  const byteRanges = byteRangeStrings.map(brs => brs.match(/[^[\s]*(?:\d|\/\*{10})/g));
  return {
    byteRangePlaceholder,
    byteRangeStrings,
    byteRanges
  };
};

var _default = findByteRange;
exports.default = _default;