import {test, expect, describe, afterEach, setSystemTime} from "bun:test";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "fs";
import os from "os";
import path from "path";
import {getStamp, packCards, unpackCards} from "./archive";

const tempDirs: string[] = [];

const makeTempDir = (prefix: string): string => {
    const dir = mkdtempSync(path.join(os.tmpdir(), `ichecker-${prefix}-`));
    tempDirs.push(dir);
    return dir;
};

afterEach(() => {
    setSystemTime();
    for (const dir of tempDirs.splice(0)) rmSync(dir, {recursive: true, force: true});
});

describe("packCards/unpackCards", () => {
    test("pack создаёт архив, unpack восстанавливает файлы", async () => {
        const source = makeTempDir("cards-src");
        const outDir = path.join(makeTempDir("cards-out"), "backups");
        const target = makeTempDir("cards-target");
        mkdirSync(path.join(source, "nested"), {recursive: true});
        writeFileSync(path.join(source, "card-1.jpg"), "фото-один");
        writeFileSync(path.join(source, "nested", "card-2.jpg"), "фото-два");

        const archive = await packCards(source, outDir);

        expect(existsSync(archive)).toBe(true);
        expect(path.basename(archive)).toMatch(/^ichecker-cards-\d{8}-\d{6}\.tar\.gz$/);

        await unpackCards(archive, target);

        expect(readFileSync(path.join(target, "card-1.jpg"), "utf8")).toBe("фото-один");
        expect(readFileSync(path.join(target, "nested", "card-2.jpg"), "utf8")).toBe("фото-два");
    });

    test("agents.xlsx из исходного каталога не попадает в архив", async () => {
        const source = makeTempDir("cards-src");
        const outDir = makeTempDir("cards-out");
        const target = makeTempDir("cards-target");
        writeFileSync(path.join(source, "agents.xlsx"), "таблица");
        writeFileSync(path.join(source, "card-3.jpg"), "фото-три");

        const archive = await packCards(source, outDir);
        await unpackCards(archive, target);

        expect(existsSync(path.join(target, "agents.xlsx"))).toBe(false);
        expect(existsSync(path.join(target, "card-3.jpg"))).toBe(true);
    });

    test("повторная распаковка перезаписывает существующие файлы", async () => {
        const source = makeTempDir("cards-src");
        const outDir = makeTempDir("cards-out");
        const target = makeTempDir("cards-target");
        writeFileSync(path.join(source, "card-4.jpg"), "новое");
        writeFileSync(path.join(target, "card-4.jpg"), "старое");

        const archive = await packCards(source, outDir);
        await unpackCards(archive, target);

        expect(readFileSync(path.join(target, "card-4.jpg"), "utf8")).toBe("новое");
    });

    test("несуществующий путь архива — ошибка", async () => {
        const target = makeTempDir("cards-target");

        await expect(unpackCards(path.join(target, "missing.tar.gz"), target)).rejects.toThrow();
    });

    test("getStamp возвращает штамп локального времени ГГГГММДД-ЧЧММсс", () => {
        setSystemTime(new Date("2026-01-05T03:07:09"));

        expect(getStamp()).toBe("20260105-030709");
    });
});
