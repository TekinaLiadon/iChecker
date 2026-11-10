import env from "../04-shared/utils/config";

const url = Bun.env.DATABASE_URL || env.POSTGRES_URL;
const args = Bun.argv.slice(2);

if (args.length === 0) {
    console.error("Укажи команду bunsql-native-migrate: up | status | mark --all | down | redo | ...");
    process.exit(1);
}

const proc = Bun.spawn(["bunx", "bunsql-native-migrate", ...args, "--url", url], {stdin: "inherit", stdout: "inherit", stderr: "inherit"});
process.exit(await proc.exited);
