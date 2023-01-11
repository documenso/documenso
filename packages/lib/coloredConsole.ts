// https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color

export class coloredConsole {
  public static setupColoredConsole(): void {
    let infoLog = console.info;
    let logLog = console.log;
    let errorLog = console.error;
    let warnLog = console.warn;

    let colors = {
      Reset: "\x1b[0m",
      Red: "\x1b[31m",
      Green: "\x1b[32m",
      Yellow: "\x1b[33m",
    };

    console.info = function (args: any) {
      let copyArgs = Array.prototype.slice.call(arguments);
      copyArgs.unshift(colors.Green);
      copyArgs.push(colors.Reset);
      infoLog.apply(null, copyArgs);
    };

    console.warn = function (args: any) {
      let copyArgs = Array.prototype.slice.call(arguments);
      copyArgs.unshift(colors.Yellow);
      copyArgs.push(colors.Reset);
      warnLog.apply(null, copyArgs);
    };

    console.error = function (args: any) {
      let copyArgs = Array.prototype.slice.call(arguments);
      copyArgs.unshift(colors.Red);
      copyArgs.push(colors.Reset);
      errorLog.apply(null, copyArgs);
    };
  }
}

coloredConsole.setupColoredConsole();
