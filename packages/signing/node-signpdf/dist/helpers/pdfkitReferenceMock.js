"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _abstract_reference = _interopRequireDefault(require("./pdfkit/abstract_reference"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class PDFKitReferenceMock extends _abstract_reference.default {
  constructor(index, additionalData = undefined) {
    super();
    this.index = index;

    if (typeof additionalData !== 'undefined') {
      Object.assign(this, additionalData);
    }
  }

  toString() {
    return `${this.index} 0 R`;
  }

}

var _default = PDFKitReferenceMock;
exports.default = _default;