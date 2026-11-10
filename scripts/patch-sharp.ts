import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync} from "fs";
import path from "path";

const root = process.cwd();
const stage = path.join(root, "native-stage");
const sharpLibDir = path.join(root, "node_modules", "@img", "sharp-linux-x64", "lib");
const vipsSource = path.join(root, "node_modules", "@img", "sharp-libvips-linux-x64", "lib", "libvips-cpp.so.8.18.6");

if (!existsSync(sharpLibDir) || !existsSync(vipsSource)) {
    console.error("bunsql: нативные модули sharp не найдены в node_modules — выполни bun install");
    process.exit(1);
}

mkdirSync(stage, {recursive: true});
copyFileSync(vipsSource, path.join(stage, "libvips-cpp.so.8.18.6"));

const bindingName = readdirSync(sharpLibDir).find(name => name.endsWith(".node"));
if (!bindingName) {
    console.error("bunsql: нативные модули sharp не найдены в node_modules — выполни bun install");
    process.exit(1);
}
const bindingSource = path.join(sharpLibDir, bindingName);
const bindingTarget = path.join(stage, "sharp.node");
copyFileSync(bindingSource, bindingTarget);

const data = readFileSync(bindingTarget);
const rpathCandidate = Buffer.from("$ORIGIN/../../sharp-libvips-linux-x64/lib");
const idx = data.indexOf(rpathCandidate);
if (idx === -1) {
    console.log("patch-sharp: RPATH уже пропатчен");
} else {
    const replacement = Buffer.from("$ORIGIN");
    replacement.copy(data, idx);
    data.fill(0, idx + replacement.length, idx + rpathCandidate.length);
    writeFileSync(bindingTarget, data);
}

const distDir = path.join(root, "node_modules", "sharp", "dist");
const stageLink = path.join(distDir, "native-stage");
rmSync(stageLink, {force: true});
symlinkSync("../../../native-stage", stageLink);

for (const distFile of ["sharp.cjs", "sharp.mjs"]) {
    const distPath = path.join(root, "node_modules", "sharp", "dist", distFile);
    if (!existsSync(distPath)) continue;
    const source = readFileSync(distPath, "utf8");
    if (source.includes('"./native-stage/sharp.node"')) continue;
    const patched = source.replaceAll("@img/sharp-linux-x64/sharp.node", "./native-stage/sharp.node");
    writeFileSync(distPath, patched);
}

console.log("patch-sharp: native-stage готов, loader sharp указывает на пропатченный биндинг");
