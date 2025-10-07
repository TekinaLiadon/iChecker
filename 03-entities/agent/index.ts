import {Agent, AgentInfo, Body} from "./type";

var url = "https://reestrs.minjust.gov.ru/rest/registry/39b95df9-9a68-6b6d-e1e3-e6388507067e/values";
var requiredFields: string[] = [  "field_1_i",
    "field_2_s",
    "field_3_s",
    "field_4_s",
    "field_5_s",
    "field_6_s",
    "field_12_s", // 16.08.1982
    "lastModified_l"
];
const getAgent = async (offset : number = 0): Promise<AgentInfo[]> => {
    var data : Body= {
        facets: {},
        limit: 200,
        offset,
        search: "",
        sort: [{ property: "field_1_i", direction: "desc" }],
    };
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    const result = await response.json();
    return result
}

const getFullAgent = async (): Promise<AgentInfo> => {
    const startCheck: Promise<Agent> = await getAgent()
    const total: number = startCheck.size;
    const promises = [];

    for (let offset: number = 200; offset < total; offset += 200) {
        promises.push(getAgent(offset));
    }

    let results: Agent[] = await Promise.all(promises);
    results = [startCheck, ...results]
    const fullAgentsList: Promise<AgentInfo> = results.flatMap(result =>
        result.values.map(obj =>
            Object.fromEntries(
                requiredFields.filter(key => key in obj).map(key => [key, obj[key]])
            )
        )
    );
    return fullAgentsList
}
export default getFullAgent