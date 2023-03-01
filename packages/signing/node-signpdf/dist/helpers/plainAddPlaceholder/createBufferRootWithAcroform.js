"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _getIndexFromRef = _interopRequireDefault(require("./getIndexFromRef"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const createBufferRootWithAcroform = (pdf, info, form) => {
  const rootIndex = (0, _getIndexFromRef.default)(info.xref, info.rootRef);
  return Buffer.concat([Buffer.from(`${rootIndex} 0 obj\n`), Buffer.from('<<\n'), Buffer.from(`${info.root}\n`), Buffer.from(`/AcroForm ${form}`), Buffer.from('\n>>\nendobj\n')]);
};

var _default = createBufferRootWithAcroform;
exports.default = _default;