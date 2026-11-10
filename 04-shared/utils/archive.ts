import {mkdirSync} from "fs";
import path from "path";

export const getStamp = (): string => {
    const now = new Date();
    const pad = (value: number): string => String(value).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const runTar = async (args: string[]): Promise<void> => {
    const proc = Bun.spawn(["tar", ...args], {stderr: "pipe"});
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    if (code !== 0) throw new Error(`tar завершился с кодом ${code}: ${stderr.trim()}`);
};

export const packCards = async (sourceDir: string = "uploads", outDir: string = "backups"): Promise<string> => {
    const out = path.join(outDir, `ichecker-cards-${getStamp()}.tar.gz`);
    mkdirSync(outDir, {recursive: true});
    await runTar(["-czf", out, "-C", sourceDir, "--exclude=agents.xlsx", "."]);
    return out;
};

export const unpackCards = async (archivePath: string, targetDir: string = "uploads"): Promise<void> => {
    mkdirSync(targetDir, {recursive: true});
    await runTar(["-xzf", archivePath, "-C", targetDir]);
};
