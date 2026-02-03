import getAgent from './index'
import { sql } from "bun";
import { AgentInfo} from "./type";
import fields from "../../04-shared/enums/fields";
import getStrPg from "../../04-shared/utils/getStrPg";

export default async (): Promise<void> => {
    const [data] = await sql`SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'agents'
        ) AS table_exists;`
    if(data.table_exists) return
    const fullAgentsList: Promise<AgentInfo> = await getAgent()
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

    const values = getStrPg(fullAgentsList)

    await sql.unsafe(`INSERT INTO agents (${fields.join(', ')}) VALUES ${values};`);
}