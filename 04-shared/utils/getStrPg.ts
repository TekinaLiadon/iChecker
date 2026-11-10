import type {AgentInfo} from "../../02-handlers/dto";

export default (fullAgentsList: AgentInfo[]) => {
    const escapePG = (str: AgentInfo[keyof AgentInfo]) => typeof str === "string" ? str.replace(/'/g, "''") : str;

    const values = fullAgentsList
        .map(item => `(
    '${escapePG(item.field_1_i)}',
    '${escapePG(item.field_2_s)}',
    '${escapePG(item.field_3_s)}',
    '${escapePG(item.field_4_s)}',
    '${escapePG(item.field_5_s)}',
    '${escapePG(item.field_6_s)}',
    '${escapePG(item.field_7_s)}',
    '${escapePG(item.lastModified_l)}',
    '${escapePG(item.field_12_s)}'
  )`)
        .join(',');
    return values
}
