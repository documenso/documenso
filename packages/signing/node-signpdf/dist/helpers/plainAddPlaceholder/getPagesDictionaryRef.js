"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = getPagesDictionaryRef;

var _SignPdfError = _interopRequireDefault(require("../../SignPdfError"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @param {Object} info As extracted from readRef()
 */
function getPagesDictionaryRef(info) {
  const pagesRefRegex = /\/Pages\s+(\d+\s+\d+\s+R)/g;
  const match = pagesRefRegex.exec(info.root);

  if (match === null) {
    throw new _SignPdfError.default('Failed to find the pages descriptor. This is probably a problem in node-signpdf.', _SignPdfError.default.TYPE_PARSE);
  }

  return match[1];
}