import {mkdirSync} from "fs";
import pino from "pino";
import * as path from "path";
import {envSchema} from "./config";
export interface ILogger {
    info(text: unknown): void;

    error(text: unknown): void;
}

const createLogPath = (): string => {
    const dir = path.join(process.cwd(), 'logs');
    mkdirSync(dir, {recursive: true});
    return path.join(dir, 'app.log');
};

class LoggerFile implements ILogger {
    pino = pino({level: 'info'}, pino.destination({dest: createLogPath(), sync: false}));

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
        return envSchema.shape.IS_DEV.parse(process.env.IS_DEV) ? new LoggerConsole() : new LoggerFile()
    }
}