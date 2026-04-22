declare module 'pompelmi' {
  export enum Verdict {
    Clean = 'clean',
    Malicious = 'malicious',
    ScanError = 'error',
  }

  export interface ScanResult {
    verdict: Verdict;
    viruses: string[];
    isInfected: boolean;
  }

  export function scan(
    input: Buffer | string,
    options?: { host?: string; port?: number },
  ): Promise<ScanResult>;
}
