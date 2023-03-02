"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _getIndexFromRef = _interopRequireDefault(require("./getIndexFromRef"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @param {Buffer} pdf
 * @param {Map} refTable
 * @returns {object}
 */
const findObject = (pdf, refTable, ref) => {
  const index = (0, _getIndexFromRef.default)(refTable, ref);
  const offset = refTable.offsets.get(index);
  let slice = pdf.slice(offset);
  slice = slice.slice(0, slice.indexOf('endobj', 'utf8')); // FIXME: What if it is a stream?

  slice = slice.slice(slice.indexOf('<<', 'utf8') + 2);
  slice = slice.slice(0, slice.lastIndexOf('>>', 'utf8'));
  return slice;
};

var _default = findObject;
exports.default = _default;