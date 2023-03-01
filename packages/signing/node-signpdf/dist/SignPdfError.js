"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.ERROR_VERIFY_SIGNATURE = exports.ERROR_TYPE_UNKNOWN = exports.ERROR_TYPE_PARSE = exports.ERROR_TYPE_INPUT = void 0;
const ERROR_TYPE_UNKNOWN = 1;
exports.ERROR_TYPE_UNKNOWN = ERROR_TYPE_UNKNOWN;
const ERROR_TYPE_INPUT = 2;
exports.ERROR_TYPE_INPUT = ERROR_TYPE_INPUT;
const ERROR_TYPE_PARSE = 3;
exports.ERROR_TYPE_PARSE = ERROR_TYPE_PARSE;
const ERROR_VERIFY_SIGNATURE = 4;
exports.ERROR_VERIFY_SIGNATURE = ERROR_VERIFY_SIGNATURE;

class SignPdfError extends Error {
  constructor(msg, type = ERROR_TYPE_UNKNOWN) {
    super(msg);
    this.type = type;
  }

} // Shorthand


SignPdfError.TYPE_UNKNOWN = ERROR_TYPE_UNKNOWN;
SignPdfError.TYPE_INPUT = ERROR_TYPE_INPUT;
SignPdfError.TYPE_PARSE = ERROR_TYPE_PARSE;
SignPdfError.VERIFY_SIGNATURE = ERROR_VERIFY_SIGNATURE;
var _default = SignPdfError;
exports.default = _default;