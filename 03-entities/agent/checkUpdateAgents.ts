import getAgent from './index'
import {AgentInfo} from "./type"
import { sql } from "bun";
import fields from "../../04-shared/enums/fields";
import getStrPg from "../../04-shared/utils/getStrPg";
export default async (): Promise<AgentInfo[]> => {
    const fullAgentsList: Promise<AgentInfo[]> = await getAgent()

    const mismatchedFieldNumbers: number[] = [];
    const updateFieldNumbers: number[] = [];
    for (let obj of fullAgentsList) {
        const result = await sql.unsafe(`
        SELECT field_number, exclusion_date
        FROM agents
        WHERE field_number = ${obj.field_1_i}`);

        if(result.length === 0) mismatchedFieldNumbers.push(obj.field_1_i);
        else if (result[0].exclusion_date !== obj.field_5_s) {
            updateFieldNumbers.push(obj.field_1_i);
        }
    }
    const resultNew: AgentInfo[] = fullAgentsList
        .filter((agent: AgentInfo) => mismatchedFieldNumbers.find((el:number):boolean => el == agent.field_1_i))
    const resultUpdate: AgentInfo[] = fullAgentsList
        .filter((agent: AgentInfo) => updateFieldNumbers.find((el: number):boolean => el == agent.field_1_i))
    if(resultNew.length > 0) {
        const values = getStrPg(resultNew)
        await sql.unsafe(`INSERT INTO agents (${fields.join(', ')}) VALUES ${values};`);
    }
    if(resultUpdate.length > 0) await sql`UPDATE agents SET exclusion_date =${resultUpdate[0].field_5_s} WHERE field_number IN ${sql(updateFieldNumbers)}`
    console.log(resultNew[0])
    return [...resultNew, ...resultUpdate]
}