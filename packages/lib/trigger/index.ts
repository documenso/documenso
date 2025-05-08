import { extractBodyContractTask } from './example';

interface Template {
  id: string;
  name: string;
  description?: string;
  content: string;
  contentType: 'markdown' | 'pdf' | 'docx';
  fields: TemplateField[];
}

interface TemplateField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'currency';
  placeholder?: string;
  required: boolean;
}
type ContractForm = {
  id: number;
  name: string | null;
  url: string | null;
  workspacesId: number | null;
  status: string | null;
  form_fields: TemplateField[] | null;
};

export const getExtractBodyContractTask = async (
  pdfUrls: string[],
  workspaceId: number,
  fileId: number,
  name: string,
) => {
  const { id } = await extractBodyContractTask.trigger({
    id: fileId,
    workspace: workspaceId,
    pdfUrls: pdfUrls,
    name: name,
  });
  return id;
};
