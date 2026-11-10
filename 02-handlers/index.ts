import {Agent, IAgentDb, IAgentInfo, AgentInfo, Body, IMoviesAgent, Query} from "./dto";
import {sql} from "bun";
import getStrPg from "../04-shared/utils/getStrPg";
import fetchRetry from "../04-shared/utils/fetchRetry";
import env from "../04-shared/utils/config";
import fields from "../04-shared/enums/fields";

const KINOPOISK_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class AgentPostgres implements IAgentDb {
    async hasLegacySchema(): Promise<boolean> {
        const [data] = await sql`SELECT
                        EXISTS (
                            SELECT 1
                            FROM information_schema.tables
                            WHERE table_schema = 'public'
                            AND table_name = 'agents'
                        ) AS agents_exists,
                        EXISTS (
                            SELECT 1
                            FROM information_schema.tables
                            WHERE table_schema = 'public'
                            AND table_name = 'info'
                        ) AS info_exists,
                        EXISTS (
                            SELECT 1
                            FROM information_schema.tables
                            WHERE table_schema = 'public'
                            AND table_name = 'migrations'
                        ) AS migrations_exists;`
        return data.agents_exists && data.info_exists && !data.migrations_exists
    }

    async isEmpty(): Promise<boolean> {
        const [{count}] = await sql<{count: number}[]>`SELECT COUNT(*)::int AS count FROM agents;`
        return count === 0
    }

    async insertAgents(fullAgentsList: AgentInfo[]): Promise<void> {
        if (fullAgentsList.length === 0) return
        const values = getStrPg(fullAgentsList)
        await sql.unsafe(`INSERT INTO agents (${fields.join(', ')}) VALUES ${values};`);
    }

    async updateAgents(fullAgentsList: AgentInfo[]): Promise<AgentInfo[]> {
        const mismatchedFieldNumbers = new Set();
        const updateFieldNumbers = new Set();
        for (let obj of fullAgentsList) {
            if (!obj.field_1_i) continue // TODO
            const result = await sql.unsafe(`
        SELECT field_number, exclusion_date
        FROM agents
        WHERE field_number = ${obj.field_1_i}`);
            if (result.length === 0) mismatchedFieldNumbers.add(obj.field_1_i);
            else if (result[0].exclusion_date !== obj.field_5_s) {
                updateFieldNumbers.add(obj.field_1_i);
            }
        }

        const resultNew: AgentInfo[] = fullAgentsList
            .filter((agent: AgentInfo) => mismatchedFieldNumbers.has(agent.field_1_i))
        const resultUpdate: AgentInfo[] = fullAgentsList
            .filter((agent: AgentInfo) => updateFieldNumbers.has(agent.field_1_i))

        if (resultNew.length > 0) {
            const values = getStrPg(resultNew)
            await sql.unsafe(`INSERT INTO agents (${fields.join(', ')}) VALUES ${values};`);
        }

        if (resultUpdate.length > 0) await sql`UPDATE agents SET exclusion_date =${resultUpdate[0].field_5_s} WHERE field_number IN ${sql([...updateFieldNumbers])}`

        return [...resultNew, ...resultUpdate]
    }

    async getAgentFull(name: string, number: number | string = 0): Promise<Agent> {
        const result = await sql`
        SELECT a.*, i.img, i.description 
        FROM agents a
        LEFT JOIN info i ON a.id = i.agent_id
        WHERE EXISTS (
            SELECT 1
            FROM unnest(regexp_split_to_array(a.name, '[\\s"]+')) AS part
            WHERE LOWER(trim(both '()' from part)) = LOWER(${name})
        ) 
        ORDER BY a.id 
        LIMIT 1 OFFSET ${number};`;

        if (!result[0]) throw new Error("Ничего не найдено")

        const countResult = await sql`SELECT COUNT(*) FROM agents WHERE SPLIT_PART(name, ' ', 1) ILIKE ${name}`;

        return {...result[0], coincidences: countResult[0].count}
    }

    async getAgentByFieldNumber(field_number: number): Promise<Agent | null> {
        const result = await sql`
        SELECT a.*, i.img, i.description 
        FROM agents a
        LEFT JOIN info i ON a.id = i.agent_id
        WHERE a.field_number = ${field_number};`;

        return result[0] || null
    }

    async editDescription(id: number, description: string): Promise<void> {
        await sql`INSERT INTO info (description, agent_id) VALUES ( ${description}, ${id}) 
        ON CONFLICT (agent_id) DO UPDATE SET
        description = EXCLUDED.description;`
    }

    async editSrcImg(id: number, fileName: string): Promise<void> {
        await sql`INSERT INTO info (img, agent_id) VALUES ( ${fileName}, ${id}) 
        ON CONFLICT (agent_id) DO UPDATE SET
        img = EXCLUDED.img;`
    }

    async editLink(id: number, field_number: number | string): Promise<string> {
        const [{
            name
        }] = await sql`UPDATE agents SET kinopoisk_id = ${id} WHERE field_number = ${field_number} RETURNING name;`
        return name
    }

    async getTableAgents(): Promise<any> {
        const info = await sql`SELECT a.*, i.description
                    FROM agents a
                    LEFT JOIN info i ON a.id = i.agent_id ORDER BY a.field_number`

        const excelSheet = info.map((el: any) => {
            return {
                'Номер': el.field_number,
                'Тип': el.type_agent || 'Не указан',
                'Имя': el.name,
                'Причина добавления': el.article,
                'День рождение': el.birthday || 'Не указано',
                'Дата добавления': el.adoption_date,
                'Дата удаления': el.exclusion_date || 'Не удален/a',
                'Ссылки на ресурсы': el.domain_name || 'Отсутствуют',
                'Кинопоиск': el.kinopoisk_id ? `https://www.kinopoisk.ru/name//${el.kinopoisk_id}/` : 'Не добавлен',
                'Описание': el.description || 'Не добавлено'
            }
        })
        return excelSheet
    }

    async updateKinopoiskInfo(id: number, json: any): Promise<void> {
        await sql`UPDATE agents SET kinopoisk_full = ${json}::jsonb WHERE id = ${id};`
    }
}

export class AgentMinjust implements IAgentInfo {
    static url = "https://reestrs.minjust.gov.ru/rest/registry/39b95df9-9a68-6b6d-e1e3-e6388507067e/values";
    static requiredFields: (keyof AgentInfo)[] = ["field_1_i",
        "field_2_s",
        "field_3_s",
        "field_4_s",
        "field_5_s",
        "field_6_s",
        "field_7_s",
        "field_12_s", // 16.08.1982
        "lastModified_l"
    ]

    async getAgent(offset: number = 0): Promise<{size: number; values: AgentInfo[]}> {
        var data: Body = {
            facets: {},
            limit: 200,
            offset,
            search: "",
            sort: [{property: "field_1_i", direction: "desc"}],
        };
        const response = await fetchRetry(AgentMinjust.url, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data),
        });

        const result = await response.json();
        return result
    }

    async getAgentsList(): Promise<AgentInfo[]> {
        const startCheck = await this.getAgent()
        const total: number = startCheck.size;
        const promises = [];

        for (let offset: number = 200; offset < total; offset += 200) {
            promises.push(this.getAgent(offset));
        }

        const pages = [startCheck, ...await Promise.all(promises)]

        const fullAgentsList: AgentInfo[] = pages.flatMap(page =>
            page.values.map(obj =>
                Object.fromEntries(
                    AgentMinjust.requiredFields.filter(key => key in obj).map(key => [key, obj[key]])
                ) as AgentInfo
            )
        );
        return fullAgentsList
    }
}

export class AgentKinopoisk implements IMoviesAgent {

    db = new AgentPostgres()

    async getPersonInfo(id: number, personId: number): Promise<any> {
        var url: string = `https://api.kinopoisk.dev/v1.4/person/${id}`
        const response = await fetchRetry(url, {
            headers: {"Content-Type": "application/json", "X-API-KEY": env.KINOPOISK_TOKEN},
        });
        let result = await response.json();
        if (personId) {
            result.timestamp = Date.now()
            await this.db.updateKinopoiskInfo(personId, result)
        }
        if (!result) return {}
        return result
    }

    async getMoviesAgent(info: Agent): Promise<any> {
        const isActual: boolean =
            info?.kinopoisk_info?.[0]?.timestamp + KINOPOISK_CACHE_TTL_MS > Date.now()
        if (isActual) {
            return info.kinopoisk_info
        }
        return await this.getPersonList(info.name, info.birthday, info.type_agent, info.id)
    }

    async getPersonList(query: string, birthday: string | undefined, type: string | undefined, id: number | null) {
        if (type !== "Физические лица") return '-'

        const name = this.nameCheck(query)

        if (name === '-') return name

        const data: Query = {
            page: 1,
            limit: 5,
            query: name,
        };
        const url: string = `https://api.kinopoisk.dev/v1.4/person/search?${new URLSearchParams({page: String(data.page), limit: String(data.limit), query: data.query}).toString()}`
        const response = await fetchRetry(url, {
            headers: {"Content-Type": "application/json", "X-API-KEY": env.KINOPOISK_TOKEN},
        });

        let {docs: result} = await response.json();
        result = result.filter((el: any) => {
            return this.areDatesEqual(el.birthday, birthday)
        })

        if (id) {
            const dataSave = result.map((el: any) => {
                el.timestamp = Date.now()
                return el
            })
            await this.db.updateKinopoiskInfo(id, dataSave)
        }

        if (result.length === 0) return []
        return result
    }

    areDatesEqual(date1: unknown, date2: unknown) {
        const normalizeDate = (date: unknown) => {
            let d;
            if (typeof date === 'string') {
                if (date.includes('T') && date.includes('Z')) {
                    d = new Date(date);
                } else {
                    const parts = date.split('.');
                    if (parts.length === 3) {
                        d = new Date(Date.UTC(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])));
                    } else {
                        d = new Date(date);
                    }
                }
            } else if (date instanceof Date) {
                d = date;
            } else {
                return null;
            }

            if (isNaN(d.getTime())) {
                return null;
            }

            return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        };

        const normalizedDate1 = normalizeDate(date1);
        const normalizedDate2 = normalizeDate(date2);

        if (normalizedDate1 === null) {
            return true;
        } else if (normalizedDate2 === null) {
            return false
        }

        return normalizedDate1.getTime() === normalizedDate2.getTime();
    }

    nameCheck(str: string): string {
        const [firstName, lastName] = str.trim().split(/\s+/)
        if (!/^[А-ЯЁA-Z]/.test(firstName) || !/^[А-ЯЁA-Z]/.test(lastName)) return '-'
        const quotedTextMatch = str.match(/"([^"]+)"/)
        if (quotedTextMatch) {
            if (quotedTextMatch[1]) {
                const words = quotedTextMatch[1]?.match(/\b\w+\b/g);
                if (words) {
                    const wordsWithoutBrackets = words.filter(word => {
                        const regex = new RegExp(`\\(${word}\\)|\\(${word}|${word}\\)`);
                        return !regex.test(quotedTextMatch[1]);
                    });
                    return wordsWithoutBrackets.join('')
                }
            }
        }
        return `${lastName} ${firstName}`
    }

    async getPersonIdInfo(info: Agent): Promise<any> {
        const isActual = info?.kinopoisk_full?.timestamp + KINOPOISK_CACHE_TTL_MS > Date.now()
        if (isActual) return info.kinopoisk_full

        return await this.getPersonInfo(info?.kinopoisk_id, info.id)
    }
}