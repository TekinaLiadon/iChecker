export interface IAgentDb {
    hasLegacySchema(): Promise<boolean>;
    isEmpty(): Promise<boolean>;
    insertAgents(fullAgentsList: AgentInfo[]): Promise<void>;
    updateAgents(fullAgentsList: AgentInfo[]): Promise<AgentInfo[]>
    getAgentFull(name: string, number: number | string): Promise<Agent>;
    getAgentByFieldNumber(field_number: number): Promise<Agent | null>;
    editDescription(id: number, description: string): Promise<void>;
    editSrcImg(id: number, fileName: string): Promise<void>;
    editLink(id: number, field_number: number | string): Promise<string>;
    getTableAgents(): Promise<any>;
    updateKinopoiskInfo(id: number, json: any): Promise<void>
}

export type Agent = {
    id: number;
    field_number: number;
    name: string;
    article: string;
    adoption_date: string;
    exclusion_date: string | null;
    domain_name: string;
    type_agent: string;
    kinopoisk_info: any | null;
    birthday: any;
    last_modified: any;
    kinopoisk_id: any | null;
    kinopoisk_full: any | null;
    img: string | null;
    description: string;
    coincidences?: number;
}

export type AgentInfo = {
    field_1_i: number;
    field_2_s: string;
    field_3_s?: string;
    field_4_dt?: string;
    field_4_s?: string;
    field_5_s?: string;
    field_6_s?: string;
    field_7_s?: string;
    field_8_s?: string;
    field_9_s?: string;
    field_10_s?: string;
    field_11_s?: string;
    field_12_s?: string;
    field_13_s?: string;
    field_14_s?: string;
    field_15_dt?: string;
    field_15_s?: string;
    field_16_s?: string;
    field_17_s?: string;
    field_18_s?: string;
    field_19_s?: string;
    field_20_s?: string;
    field_21_s?: string;
    grid_s?: string;
    id?: string;
    lastModified_l?: number;
    _version_?: number;
}

export interface IMoviesAgent {
    getPersonInfo(id: number, personId: number): Promise<any>;
    getMoviesAgent(info: Agent): Promise<any>;
    getPersonList(query: string, birthday: string | undefined, type: string | undefined, id: number | null): Promise<any>;
    getPersonIdInfo(info: Agent): Promise<any>;
}

export type Query = {
    page: number,
    limit: number,
    query: string,
}

export interface IAgentInfo {
    getAgent(offset: number): Promise<{size: number; values: AgentInfo[]}>;
    getAgentsList(): Promise<AgentInfo[]>;
}

export type Body = {
    facets: Record<string, unknown>,
    limit: number,
    offset: number,
    search: string,
    sort: Array<{
        property: string,
        direction: "asc" | "desc"
    }>
}