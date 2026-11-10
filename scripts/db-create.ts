import {SQL} from "bun";
import {markMigrationsApplied, migrateUp} from "bunsql-native-migrate";
import {AgentPostgres} from "../02-handlers/index";
import env from "../04-shared/utils/config";

const url = Bun.env.DATABASE_URL || env.POSTGRES_URL;
const target = new URL(url);
const dbName = decodeURIComponent(target.pathname.slice(1));

if (!dbName) {
    console.error("В POSTGRES_URL не указано имя базы");
    process.exit(1);
}

target.pathname = "/postgres";
target.hash = "";
const server = new SQL(target.toString());

const [exists] = await server`SELECT 1 AS exists FROM pg_database WHERE datname = ${dbName}`;
if (exists) {
    console.log(`База ${dbName} уже существует`);
} else {
    const quoted = `"${dbName.replaceAll('"', '""')}"`;
    await server.unsafe(`CREATE DATABASE ${quoted}`);
    console.log(`База ${dbName} создана`);
}
await server.end();

const postgres = new AgentPostgres();
if (await postgres.hasLegacySchema()) {
    await markMigrationsApplied({databaseUrl: url});
    console.log("Легаси-схема: миграции помечены применёнными без выполнения");
} else {
    const {applied} = await migrateUp({databaseUrl: url});
    console.log(applied.length > 0 ? `Таблицы созданы: ${applied.join(", ")}` : "Таблицы уже на месте");
}
