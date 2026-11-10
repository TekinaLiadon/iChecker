import {test, expect, describe} from "bun:test";
import {pathToFileURL} from "url";
import path from "path";
import {parseEnv} from "./config";

const validEnv = {
    BOT_TOKEN: "580:test-token",
    BOT_CHAT: "-1001234567890",
    POSTGRES_URL: "postgres://user:password@localhost:5432/db_name",
    KINOPOISK_TOKEN: "kinopoisk-token",
};

const configUrl = pathToFileURL(path.join(import.meta.dir, "config.ts")).href;

const runConfigProcess = async (env: Record<string, string>) => {
    const proc = Bun.spawn(
        [process.execPath, "-e", `await import(${JSON.stringify(configUrl)})`],
        {cwd: "/tmp", env, stdout: "pipe", stderr: "pipe"}
    );
    const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
    return {code, stderr};
};

describe("config — parseEnv", () => {
    test("полный валидный env распарсен с приведением типов", () => {
        const env = parseEnv(validEnv);

        expect(env.BOT_TOKEN).toBe("580:test-token");
        expect(env.BOT_CHAT).toBe(-1001234567890);
        expect(env.POSTGRES_URL).toBe("postgres://user:password@localhost:5432/db_name");
        expect(env.KINOPOISK_TOKEN).toBe("kinopoisk-token");
        expect(env.IS_DEV).toBe(false);
    });

    test("IS_DEV=true распознаётся как dev-режим", () => {
        const env = parseEnv({...validEnv, IS_DEV: "true"});

        expect(env.IS_DEV).toBe(true);
    });

    test("IS_DEV=false распознаётся как prod-режим", () => {
        const env = parseEnv({...validEnv, IS_DEV: "false"});

        expect(env.IS_DEV).toBe(false);
    });

    test("IS_DEV=yes распознаётся zod-дефолтами stringbool как true", () => {
        const env = parseEnv({...validEnv, IS_DEV: "yes"});

        expect(env.IS_DEV).toBe(true);
    });

    test.each([
        "1_or_nothing",
        "истина",
    ])("IS_DEV=%s отклоняется", (value) => {
        expect(() => parseEnv({...validEnv, IS_DEV: value})).toThrow();
    });

    test.each([
        ["BOT_TOKEN", ""],
        ["BOT_TOKEN", undefined],
        ["KINOPOISK_TOKEN", ""],
        ["POSTGRES_URL", "not-a-url"],
        ["POSTGRES_URL", "ftp://only-scheme-checked"],
        ["BOT_CHAT", "abc"],
        ["BOT_CHAT", ""],
    ])("%s=%s отклоняется", (key, value) => {
        const broken: Record<string, string | undefined> = {...validEnv};
        if (value === undefined) delete broken[key];
        else broken[key] = value;

        expect(() => parseEnv(broken)).toThrow();
    });

    test("BOT_CHAT принимает положительные id", () => {
        const env = parseEnv({...validEnv, BOT_CHAT: "12345"});

        expect(env.BOT_CHAT).toBe(12345);
    });
});

describe("config — запуск процесса", () => {
    test("валидный env парсится, дефолт IS_DEV для прода — false", async () => {
        const proc = Bun.spawn(
            [
                process.execPath,
                "-e",
                `const {default: env} = await import(${JSON.stringify(configUrl)});
                 console.log(env.BOT_CHAT, env.IS_DEV);`,
            ],
            {cwd: "/tmp", env: validEnv, stdout: "pipe", stderr: "pipe"}
        );
        const [code, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()]);

        expect(code).toBe(0);
        expect(stdout).toContain("-1001234567890");
        expect(stdout).toContain("false");
    });

    test("невалидный env завершает процесс с кодом 1 и списком ошибок", async () => {
        const {code, stderr} = await runConfigProcess({BOT_CHAT: "abc"});

        expect(code).toBe(1);
        expect(stderr).toContain("BOT_TOKEN");
    });
});
