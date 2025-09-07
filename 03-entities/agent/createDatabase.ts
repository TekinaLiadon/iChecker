import getAgent from './index'
import { sql } from "bun";
import { AgentInfo} from "./type";

export default async () => {
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
    name TEXT NOT NULL,
    article TEXT NOT NULL,
    adoption_date TEXT,
    exclusion_date TEXT,
    domain_name TEXT,
    last_modified BIGINT NOT NULL);`


    const fields = [  'field_number', 'name', 'article',
        'adoption_date', 'exclusion_date',
        'domain_name', 'last_modified'
    ];

    const escapePG = str => typeof str === "string" ? str.replace(/'/g, "''") : str;

    const values = fullAgentsList
        .map(item => `(
    '${escapePG(item.field_1_i)}',
    '${escapePG(item.field_2_s)}',
    '${escapePG(item.field_3_s)}',
    '${escapePG(item.field_4_s)}',
    '${escapePG(item.field_5_s)}',
    '${escapePG(item.field_6_s)}',
    '${escapePG(item.lastModified_l)}'
  )`)
        .join(','); // Экранировать

    await sql.unsafe(`INSERT INTO agents (${fields.join(', ')}) VALUES ${values};`);
}
