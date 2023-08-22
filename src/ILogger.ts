export interface ILogger {
  extend(name: string): ILogger;
  info(fmt: string, ...args: any[]): void;
  warn(fmt: string, ...args: any[]): void;
  error(fmt: string, ...args: any[]): void;
  debug(fmt: string, ...args: any[]): void;
}
