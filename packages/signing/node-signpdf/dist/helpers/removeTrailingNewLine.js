"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _SignPdfError = _interopRequireDefault(require("../SignPdfError"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const sliceLastChar = (pdf, character) => {
  const lastChar = pdf.slice(pdf.length - 1).toString();

  if (lastChar === character) {
    return pdf.slice(0, pdf.length - 1);
  }

  return pdf;
};
/**
 * Removes a trailing new line if there is such.
 *
 * Also makes sure the file ends with an EOF line as per spec.
 * @param {Buffer} pdf
 * @returns {Buffer}
 */


const removeTrailingNewLine = pdf => {
  if (!(pdf instanceof Buffer)) {
    throw new _SignPdfError.default('PDF expected as Buffer.', _SignPdfError.default.TYPE_INPUT);
  }

  let output = pdf;
  output = sliceLastChar(output, '\n');
  output = sliceLastChar(output, '\r');
  const lastLine = output.slice(output.length - 6).toString();

  if (lastLine !== '\n%%EOF') {
    throw new _SignPdfError.default('A PDF file must end with an EOF line.', _SignPdfError.default.TYPE_PARSE);
  }

  return output;
};

var _default = removeTrailingNewLine;
exports.default = _default;