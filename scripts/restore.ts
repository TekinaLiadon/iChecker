import {existsSync} from "fs";
import {sql} from "bun";
import {markMigrationsApplied, migrateUp} from "bunsql-native-migrate";
import {AgentPostgres} from "../02-handlers/index";
import env from "../04-shared/utils/config";

const url = Bun.env.DATABASE_URL || env.POSTGRES_URL;
const file = Bun.argv[2];

if (!file) {
    console.error("Укажи путь к дампу: bun run restore backups/ichecker-db-ГГГГММДД-ЧЧММсс.dump");
    process.exit(1);
}
if (!existsSync(file)) {
    console.error(`Дамп не найден: ${file}`);
    process.exit(1);
}

try {
    const postgres = new AgentPostgres();
    if (await postgres.hasLegacySchema()) {
        await markMigrationsApplied({databaseUrl: url});
        console.log("Легаси-схема: миграции помечены применёнными без выполнения");
    } else {
        await migrateUp({databaseUrl: url});
    }

    await sql`TRUNCATE info, agents RESTART IDENTITY CASCADE`;

    const proc = Bun.spawn(["pg_restore", "--data-only", "--no-owner", "--no-privileges", "--exit-on-error", "-d", url, file], {stderr: "pipe"});
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    if (code !== 0) {
        console.error(stderr.trim());
        process.exit(1);
    }
    console.log(`База данных восстановлена из ${file}`);
} catch (e) {
    console.error(e);
    process.exit(1);
}
