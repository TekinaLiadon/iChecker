import {test, expect, describe, beforeAll, afterAll} from "bun:test";
import {AgentPostgres} from "./index";
import {sql} from "bun";
import path from "path";
import {migrateDown, migrateUp, markMigrationsApplied, migrateStatus} from "bunsql-native-migrate";
import type {AgentInfo} from "./dto";

const TEST_POSTGRES_URL = "postgres://postgres:postgres@127.0.0.1:5436/ichecker_test";
const MIGRATIONS_DIR = path.join(import.meta.dir, "..", "migrations");

const makeAgentInfo = (overrides: Partial<AgentInfo> = {}): AgentInfo => ({
    field_1_i: 42,
    field_2_s: "Иванов Иван Иванович",
    field_3_s: "Основание добавления",
    field_4_s: "01.01.2020",
    field_5_s: "",
    field_6_s: "https://example.com",
    field_7_s: "Физические лица",
    field_12_s: "01.01.1980",
    lastModified_l: 1600000000,
    ...overrides,
});

const canConnect = async (): Promise<boolean> => {
    try {
        await sql`SELECT 1`;
        return true;
    } catch {
        return false;
    }
};

process.env.POSTGRES_URL = TEST_POSTGRES_URL;
const connected = await canConnect();

const dropAll = async () => {
    await sql`DROP TABLE IF EXISTS info`;
    await sql`DROP TABLE IF EXISTS agents`;
    await sql`DROP TABLE IF EXISTS migrations`;
};

const createLegacyTables = async () => {
    await sql`CREATE TABLE agents (
            id SERIAL PRIMARY KEY,
            field_number INTEGER NOT NULL,
            name VARCHAR(256) NOT NULL,
            article TEXT NOT NULL,
            adoption_date VARCHAR(256),
            exclusion_date VARCHAR(256),
            domain_name TEXT,
            type_agent VARCHAR(256),
            kinopoisk_info jsonb,
            kinopoisk_id INTEGER,
            kinopoisk_full jsonb,
            birthday VARCHAR(64),
            last_modified BIGINT NOT NULL);`

    await sql`CREATE TABLE info (
            id SERIAL PRIMARY KEY,
            img VARCHAR(256),
            description TEXT,
            agent_id INTEGER UNIQUE REFERENCES agents(id) ON DELETE CASCADE
            );`
};

describe.skipIf(!connected)("миграции — чистая база", () => {
    beforeAll(async () => {
        await dropAll();
        await migrateUp({databaseUrl: TEST_POSTGRES_URL, listDir: MIGRATIONS_DIR});
    });

    afterAll(async () => {
        await dropAll();
    });

    test("up применяет базлайн-миграцию и записывает checksum", async () => {

        const status = await migrateStatus({databaseUrl: TEST_POSTGRES_URL, listDir: MIGRATIONS_DIR});

        expect(status.applied).toHaveLength(1);
        expect(status.applied[0]?.name).toContain("baseline_agents_info");
        expect(status.applied[0]?.checksum).toMatch(/^[0-9a-f]{64}$/u);
        expect(status.pending).toEqual([]);
    });

    test("схема agents идентична прежней createDatabase", async () => {

        const columns = await sql`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'agents'
            ORDER BY ordinal_position;`;

        expect(columns.map((c: { column_name: string; data_type: string; is_nullable: string }) =>
            [c.column_name, c.data_type, c.is_nullable]
        )).toEqual([
            ["id", "integer", "NO"],
            ["field_number", "integer", "NO"],
            ["name", "character varying", "NO"],
            ["article", "text", "NO"],
            ["adoption_date", "character varying", "YES"],
            ["exclusion_date", "character varying", "YES"],
            ["domain_name", "text", "YES"],
            ["type_agent", "character varying", "YES"],
            ["kinopoisk_info", "jsonb", "YES"],
            ["kinopoisk_id", "integer", "YES"],
            ["kinopoisk_full", "jsonb", "YES"],
            ["birthday", "character varying", "YES"],
            ["last_modified", "bigint", "NO"],
        ]);
    });

    test("схема info идентична прежней createDatabase", async () => {

        const columns = await sql`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'info'
            ORDER BY ordinal_position;`;

        expect(columns.map((c: { column_name: string; data_type: string; is_nullable: string }) =>
            [c.column_name, c.data_type, c.is_nullable]
        )).toEqual([
            ["id", "integer", "NO"],
            ["img", "character varying", "YES"],
            ["description", "text", "YES"],
            ["agent_id", "integer", "YES"],
        ]);
    });

    test("ограничения: PK, FK с каскадом и UNIQUE на месте", async () => {

        const [agentsPk] = await sql`
            SELECT contype FROM pg_constraint
            WHERE conrelid = 'agents'::regclass AND contype = 'p';`;
        expect(agentsPk).toBeDefined();

        const [infoFk] = await sql`
            SELECT confdeltype FROM pg_constraint
            WHERE conrelid = 'info'::regclass AND contype = 'f';`;
        expect(infoFk.confdeltype).toBe("c");

        const [infoUnique] = await sql`
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'info'::regclass AND contype = 'u';`;
        expect(infoUnique).toBeDefined();

        const [idDefault] = await sql`
            SELECT column_default FROM information_schema.columns
            WHERE table_name = 'agents' AND column_name = 'id';`;
        expect(String(idDefault.column_default)).toContain("nextval");
    });

    test("повторный up не применяет ничего", async () => {

        const {applied} = await migrateUp({databaseUrl: TEST_POSTGRES_URL, listDir: MIGRATIONS_DIR});

        expect(applied).toEqual([]);
        const status = await migrateStatus({databaseUrl: TEST_POSTGRES_URL, listDir: MIGRATIONS_DIR});
        expect(status.pending).toEqual([]);
    });

    test("down откатывает базлайн-миграцию вместе со схемой", async () => {
        const {reverted} = await migrateDown({databaseUrl: TEST_POSTGRES_URL, listDir: MIGRATIONS_DIR});

        expect(reverted).toHaveLength(1);
        const [agents] = await sql`SELECT to_regclass('public.agents') AS name`;
        expect(agents.name).toBeNull();
        const [info] = await sql`SELECT to_regclass('public.info') AS name`;
        expect(info.name).toBeNull();

        await migrateUp({databaseUrl: TEST_POSTGRES_URL, listDir: MIGRATIONS_DIR});
    });
});

describe.skipIf(!connected)("миграции — baseline существующей базы", () => {
    beforeAll(async () => {
        await dropAll();
        await createLegacyTables();
        await sql`INSERT INTO agents (field_number, name, article, last_modified)
                  VALUES (1, 'Легаси Агент', 'старое основание', 1);`;
        await markMigrationsApplied({databaseUrl: TEST_POSTGRES_URL, listDir: MIGRATIONS_DIR});
    });

    afterAll(async () => {
        await dropAll();
    });

    test("mark записывает историю без выполнения миграций", async () => {

        const [record] = await sql`
            SELECT migration, checksum FROM migrations ORDER BY migration;`;

        expect(record.migration).toContain("baseline_agents_info");
        expect(record.checksum).toMatch(/^[0-9a-f]{64}$/u);

        const [agents] = await sql`SELECT to_regclass('public.agents') AS name`;
        expect(agents.name).toBe("agents");
    });

    test("легаси-данные не тронуты", async () => {

        const [row] = await sql`SELECT name FROM agents WHERE field_number = 1;`;
        expect(row.name).toBe("Легаси Агент");
    });

    test("после baseline повторный up не применяет ничего", async () => {

        const {applied} = await migrateUp({databaseUrl: TEST_POSTGRES_URL, listDir: MIGRATIONS_DIR});

        expect(applied).toEqual([]);
        const status = await migrateStatus({databaseUrl: TEST_POSTGRES_URL, listDir: MIGRATIONS_DIR});
        expect(status.pending).toEqual([]);
    });
});

describe.skipIf(!connected)("AgentPostgres — интеграция с БД", () => {
    let db: AgentPostgres;

    beforeAll(async () => {
        await dropAll();
        await migrateUp({databaseUrl: TEST_POSTGRES_URL, listDir: MIGRATIONS_DIR});
        db = new AgentPostgres();
    });

    afterAll(async () => {
        await dropAll();
    });

    test("isEmpty: чистая схема без реестра пуста", async () => {

        expect(await db.isEmpty()).toBe(true);
    });

    test("insertAgents: вставляет реестр пакетом", async () => {

        await db.insertAgents([makeAgentInfo({field_1_i: 1}), makeAgentInfo({field_1_i: 2})]);

        const [row] = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM agents`;
        expect(row?.count).toBe(2);
        expect(await db.isEmpty()).toBe(false);
    });

    test("insertAgents: пустой список ничего не вставляет", async () => {

        await db.insertAgents([]);

        const [row] = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM agents`;
        expect(row?.count).toBe(2);
    });

    test("hasLegacySchema: мигрированная база не легаси", async () => {

        expect(await db.hasLegacySchema()).toBe(false);
    });

    test("updateAgents: новые агенты добавляются", async () => {

        await sql`DELETE FROM agents`;

        const result = await db.updateAgents([makeAgentInfo({field_1_i: 1}), makeAgentInfo({field_1_i: 2})]);

        expect(result).toHaveLength(2);
        const [row] = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM agents`;
        expect(row?.count).toBe(2);
    });

    test("updateAgents: ничего не возвращает при отсутствии изменений", async () => {

        const result = await db.updateAgents([makeAgentInfo({field_1_i: 1})]);

        expect(result).toHaveLength(0);
    });

    test("updateAgents: изменение exclusion_date обновляет запись", async () => {

        const result = await db.updateAgents([makeAgentInfo({field_1_i: 1, field_5_s: "31.12.2026"})]);

        expect(result).toHaveLength(1);
        const [row] = await sql`SELECT exclusion_date FROM agents WHERE field_number = 1`;
        expect(row.exclusion_date).toBe("31.12.2026");
    });

    test("updateAgents: агенты без field_1_i пропускаются", async () => {

        const broken = makeAgentInfo();
        delete (broken as Partial<AgentInfo>).field_1_i;

        const result = await db.updateAgents([broken]);

        expect(result).toHaveLength(0);
    });

    test("getAgentFull: поиск по фамилии", async () => {

        const agent = await db.getAgentFull("Иванов", 0);

        expect(agent.field_number).toBe(1);
        expect(agent.name).toContain("Иванов");
        expect(Number(agent.coincidences)).toBeGreaterThan(0);
    });

    test("getAgentFull: выбрасывает ошибку при отсутствии агента", async () => {

        await expect(db.getAgentFull("НесуществующаяФамилия", 0)).rejects.toThrow("Ничего не найдено");
    });

    test("getAgentFull: offset перебирает совпадения", async () => {

        const first = await db.getAgentFull("Иванов", 0);
        const second = await db.getAgentFull("Иванов", 1);

        expect(first.id).not.toBe(second.id);
    });

    test("getAgentByFieldNumber: находит агента по номеру реестра", async () => {

        const agent = await db.getAgentByFieldNumber(1);

        expect(agent?.name).toContain("Иванов");
        expect(agent?.id).toBeDefined();
    });

    test("getAgentByFieldNumber: возвращает null при отсутствии агента", async () => {

        const agent = await db.getAgentByFieldNumber(999999);

        expect(agent).toBeNull();
    });

    test("editDescription: добавляет описание", async () => {

        const agent = await db.getAgentFull("Иванов", 0);
        await db.editDescription(agent.id, "Тестовое описание");

        const [row] = await sql`SELECT description FROM info WHERE agent_id = ${agent.id}`;
        expect(row.description).toBe("Тестовое описание");
    });

    test("editDescription: обновляет существующее описание", async () => {

        const agent = await db.getAgentFull("Иванов", 0);
        await db.editDescription(agent.id, "Новое описание");

        const [row] = await sql`SELECT description FROM info WHERE agent_id = ${agent.id}`;
        expect(row.description).toBe("Новое описание");
    });

    test("editSrcImg: добавляет имя файла фото", async () => {

        const agent = await db.getAgentFull("Иванов", 0);
        await db.editSrcImg(agent.id, "42.webp");

        const [row] = await sql`SELECT img FROM info WHERE agent_id = ${agent.id}`;
        expect(row.img).toBe("42.webp");
    });

    test("editSrcImg: обновляет существующее фото", async () => {

        const agent = await db.getAgentFull("Иванов", 0);
        await db.editSrcImg(agent.id, "43.webp");

        const [row] = await sql`SELECT img FROM info WHERE agent_id = ${agent.id}`;
        expect(row.img).toBe("43.webp");
    });

    test("editLink: обновляет kinopoisk_id и возвращает имя", async () => {

        const name = await db.editLink(12345, 1);

        expect(name).toContain("Иванов");
        const [row] = await sql`SELECT kinopoisk_id FROM agents WHERE field_number = 1`;
        expect(row.kinopoisk_id).toBe(12345);
    });

    test("updateKinopoiskInfo: сохраняет jsonb", async () => {

        const agent = await db.getAgentFull("Иванов", 0);
        await db.updateKinopoiskInfo(agent.id, {id: 5, name: "Из Кинопоиска"});

        const [row] = await sql`SELECT kinopoisk_full FROM agents WHERE id = ${agent.id}`;
        expect(row.kinopoisk_full.name).toBe("Из Кинопоиска");
    });

    test("getTableAgents: отдаёт данные для xlsx", async () => {

        const table = await db.getTableAgents();

        expect(Array.isArray(table)).toBe(true);
        expect(table.length).toBeGreaterThan(0);
        expect(table[0]).toHaveProperty("Номер");
        expect(table[0]).toHaveProperty("Имя");
        expect(table[0]).toHaveProperty("Кинопоиск");
    });

    test("getTableAgents: кинопоиск-ссылка строится при наличии id", async () => {

        const table = await db.getTableAgents();
        const row = table.find((r: { Номер: number }) => r.Номер === 1);

        expect(row.Кинопоиск).toContain("12345");
    });

    test("удаление агента каскадно чистит info", async () => {

        const agent = await db.getAgentFull("Иванов", 1);
        await db.editDescription(agent.id, "для удаления");

        await sql`DELETE FROM agents WHERE id = ${agent.id}`;

        const [row] = await sql`SELECT COUNT(*)::int AS count FROM info WHERE agent_id = ${agent.id}`;
        expect(row.count).toBe(0);
    });
});

afterAll(() => {
    if (connected) sql.close();
});
