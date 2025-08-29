export const generateDkimRecord = (recordName: string, publicKeyFlattened: string) => {
  return {
    name: recordName,
    value: `v=DKIM1; k=rsa; p=${publicKeyFlattened}`,
    type: 'TXT',
  };
};

export const AWS_SES_SPF_RECORD = {
  name: `@`,
  value: 'v=spf1 include:amazonses.com -all',
  type: 'TXT',
};

export const generateEmailDomainRecords = (recordName: string, publicKeyFlattened: string) => {
  return [generateDkimRecord(recordName, publicKeyFlattened), AWS_SES_SPF_RECORD];
};
