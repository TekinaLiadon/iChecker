import {mkdirSync, rmSync, statSync} from "fs";
import path from "path";
import env from "../04-shared/utils/config";
import {getStamp} from "../04-shared/utils/archive";

const url = Bun.env.DATABASE_URL || env.POSTGRES_URL;
const outDir = "backups";
const file = path.join(outDir, `ichecker-db-${getStamp()}.dump`);

try {
    mkdirSync(outDir, {recursive: true});
    const proc = Bun.spawn(["pg_dump", url, "--format=custom", "--data-only", "--table=agents", "--table=info", "--no-owner", "--no-privileges", "--file", file], {stderr: "pipe"});
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    if (code !== 0) {
        console.error(stderr.trim());
        rmSync(file, {force: true});
        process.exit(1);
    }
    console.log(`Дамп создан: ${file} (${statSync(file).size} байт)`);
} catch (e) {
    console.error(e);
    process.exit(1);
}
