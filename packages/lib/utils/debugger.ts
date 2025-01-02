export const appLog = (context: string, ...args: Parameters<typeof console.log>) => {
  // if (env('NEXT_DEBUG') === 'true') {
  console.log(`[${context}]: ${args[0]}`, ...args.slice(1));
  // }
};

export class AppLogger {
  public context: string;

  constructor(context: string) {
    this.context = context;
  }

  public log(...args: Parameters<typeof console.log>) {
    appLog(this.context, ...args);
  }
}
