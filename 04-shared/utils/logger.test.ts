import {test, expect, describe, afterAll, afterEach} from "bun:test";
import * as fs from "fs";
import * as path from "path";
import type {ILogger} from "./logger";

const originalIsDev = process.env.IS_DEV;
const originalCwd = process.cwd();

const setDev = (value: string | undefined) => {
    if (value === undefined) delete process.env.IS_DEV;
    else process.env.IS_DEV = value;
};

afterEach(() => {
    setDev(originalIsDev);
});

const captureStdout = async (run: () => void): Promise<string> => {
    const chunks: Buffer[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
    }) as typeof process.stdout.write;

    try {
        run();
        await new Promise(resolve => setImmediate(resolve));
    } finally {
        process.stdout.write = originalWrite;
    }

    return Buffer.concat(chunks).toString("utf-8");
};

describe("FabricLogger", () => {
    afterAll(() => {
        try {
            fs.writeFileSync(path.join(process.cwd(), "logs", "app.log"), "");
        } catch {
        }
    });

    test("createLogger: возвращает ILogger с методами info и error", async () => {
        setDev("true");
        const {FabricLogger} = await import("./logger");

        const logger: ILogger = FabricLogger.createLogger();

        expect(typeof logger.info).toBe("function");
        expect(typeof logger.error).toBe("function");
    });

    test("createLogger: в dev-режиме пишет в консоль", async () => {
        setDev("true");
        const {FabricLogger} = await import("./logger");
        const logger = FabricLogger.createLogger();

        const output = await captureStdout(() => {
            logger.info("dev-info-message");
            logger.error("dev-error-message");
        });

        expect(output).toContain("dev-info-message");
        expect(output).toContain("dev-error-message");
    });

    test("createLogger: в prod-режиме создаёт logs и пишет в файл", async () => {
        setDev(undefined);
        const tempRoot = fs.mkdtempSync("/tmp/ichecker-test-");
        process.chdir(tempRoot);

        try {
            const {FabricLogger} = await import("./logger");
            const logger = FabricLogger.createLogger();

            expect(typeof logger.info).toBe("function");
            expect(typeof logger.error).toBe("function");

            logger.info("prod-info-message");
            logger.error("prod-error-message");

            const logFile = path.join(tempRoot, "logs", "app.log");
            let content = "";
            for (let i = 0; i < 40; i++) {
                if (fs.existsSync(logFile)) content = fs.readFileSync(logFile, "utf-8");
                if (content.includes("prod-error-message")) break;
                await Bun.sleep(50);
            }

            expect(content).toContain("prod-info-message");
            expect(content).toContain("prod-error-message");
        } finally {
            process.chdir(originalCwd);
            fs.rmSync(tempRoot, {recursive: true, force: true});
        }
    });
});
