
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


export type AgentInfo = {
    field_1_i: number;
    field_2_s: string;
    field_3_s: string;
    field_4_dt?: string;
    field_4_s: string;
    field_5_s: string;
    field_6_s: string;
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
    lastModified_l: number;
    _version_?: number;
}

type FacetCount = {
    count: number;
    name: string | null;
};

type Facet = {
    name: string;
    counts: FacetCount[];
};

export type Agent = {
    facets?: Facet[]
    limit?: number;
    offset?: number
    size?: number;
    values: AgentInfo[];
}
