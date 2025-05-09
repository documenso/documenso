import {
  extractBodyContractTask
} from "../../../../../../../chunk-JLNLIBZR.mjs";
import "../../../../../../../chunk-JJ5RXC7R.mjs";
import "../../../../../../../chunk-MDRKNOVW.mjs";
import {
  init_esm
} from "../../../../../../../chunk-IGJHZSM6.mjs";

// trigger/index.ts
init_esm();
var getExtractBodyContractTask = async (userId, documentId, urlDocument, teamId) => {
  const { id } = await extractBodyContractTask.trigger({
    userId,
    documentId,
    teamId,
    urlDocument
  });
  return id;
};
export {
  getExtractBodyContractTask
};
//# sourceMappingURL=index.mjs.map
