"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _SignPdfError = _interopRequireDefault(require("../../SignPdfError"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @param {object} refTable
 * @param {string} ref
 * @returns {number}
 */
const getIndexFromRef = (refTable, ref) => {
  let [index] = ref.split(' ');
  index = parseInt(index);

  if (!refTable.offsets.has(index)) {
    throw new _SignPdfError.default(`Failed to locate object "${ref}".`, _SignPdfError.default.TYPE_PARSE);
  }

  return index;
};

var _default = getIndexFromRef;
exports.default = _default;