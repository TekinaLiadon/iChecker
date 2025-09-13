import getAgent from './index'
import {AgentInfo} from "./type"
import { sql } from "bun";

var fields = [  'field_number', 'name', 'article',
    'adoption_date', 'exclusion_date',
    'domain_name', 'last_modified'
];
export default async (): Promise<AgentInfo[]> => {
    const fullAgentsList: Promise<AgentInfo[]> = await getAgent()

    const mismatchedFieldNumbers: number[] = [];
    const updateFieldNumbers: number[] = [];
    for (let obj of fullAgentsList) {
        const result = await sql.unsafe(`
        SELECT field_number, exclusion_date
        FROM agents
        WHERE field_number = ${obj.field_1_i}`); // Экранировать

        if(result.length === 0) mismatchedFieldNumbers.push(obj.field_1_i);
        else if (result[0].exclusion_date !== obj.field_5_s) {
            updateFieldNumbers.push(obj.field_1_i);
        }
    }
    const resultNew: AgentInfo[] = fullAgentsList.filter((agent) => mismatchedFieldNumbers.find((el) => el == agent.field_1_i))
    const resultUpdate: AgentInfo[] = fullAgentsList.filter((agent) => updateFieldNumbers.find((el) => el == agent.field_1_i))
    if(resultNew.length > 0) {
        const escapePG = str => typeof str === "string" ? str.replace(/'/g, "''") : str;
        const values = resultNew
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
    if(resultUpdate.length > 0) await sql`UPDATE agents SET exclusion_date =${resultUpdate[0].field_5_s} WHERE field_number IN ${sql(updateFieldNumbers)}`

    return [...resultNew, ...resultUpdate]
}