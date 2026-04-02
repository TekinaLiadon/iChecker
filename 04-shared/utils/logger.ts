import pino from "pino";
import * as path from "path";
export interface ILogger {
    info(text: unknown): void;

    error(text: unknown): void;
}

const logPath = path.join(process.cwd(), 'logs', 'app.log');
const transport = pino.transport({
    target: 'pino/file',
    options: {destination: logPath}
});

class LoggerFile implements ILogger {
    pino = pino({
        level: 'info'
    }, transport);

    info(text: unknown): void {
        this.pino.info(text)
    }

    error(text: unknown): void {
        this.pino.error(text)
    }
}

class LoggerConsole implements ILogger {
    pino = pino()
    info(text: unknown): void {
        this.pino.info(text)
    }

    error(text: unknown): void {
        this.pino.error(text)
    }
}

export class FabricLogger {
    static createLogger(): ILogger {
        return Bun.env.IS_DEV ? new LoggerConsole() : new LoggerFile()
    }
}