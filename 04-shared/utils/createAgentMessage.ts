
type MessagePerson = {id: number; name?: string; enName?: string};

type MessageAgent = {
    field_1_i?: number;
    field_2_s?: string;
    field_3_s?: string;
    field_4_s?: string;
    field_5_s?: string;
    field_6_s?: string;
    field_7_s?: string;
    field_12_s?: string;
    name?: string;
    description?: string;
    kinopoisk_id?: number | null;
    person?: MessagePerson[] | "-" | null;
};

type MessageOptions = {
    agent: MessageAgent;
    index?: number;
    agentsList?: unknown[];
    person?: MessagePerson[] | "-" | null;
    isShort?: boolean;
};

var renameMap: Record<string, string> = {
    field_number: 'field_1_i',
    name: 'field_2_s',
    article: 'field_3_s',
    adoption_date: 'field_4_s',
    exclusion_date: 'field_5_s',
    domain_name: 'field_6_s',
    type_agent: 'field_7_s',
    birthday: 'field_12_s',
    description: 'description',
};

const SEPARATOR = '─────────────────────';
const DASH = '—';

const formatNumber = (fieldNumber: number | undefined): string =>
    `№<code>${String(fieldNumber).padStart(4, '0')}</code>`;

const formatHeader = (agent: MessageAgent, index?: number, agentsListLength?: number): string => {
    const number = formatNumber(agent.field_1_i)
    if (index === undefined) return `<b>Карточка агента</b> · ${number}`
    if (!index) return `<b>Найденная информация</b> · ${number}`
    return `<b>Изменение списка</b> (${index + 1}/${agentsListLength}) · ${number}`
}

const formatLinks = (domainName: string | undefined): string => {
    if (!domainName) return ` ${DASH}`
    return `\n${domainName.split('; ').map(url => {
        let text = url
        try {
            text = new URL(url).hostname
        } catch {
        }
        return `<a href="${url}">${text}</a>`
    }).join('\n')}`
}

const formatKinopoisk = (agent: MessageAgent): string => {
    if (agent.kinopoisk_id)
        return `\n<a href="https://www.kinopoisk.ru/name/${agent.kinopoisk_id}">профиль Кинопоиска</a>`
    if (!agent.person || agent.person === '-' || agent.person.length === 0)
        return ` Не найдено совпадений по дню рождения`
    return `\n${agent.person.map(el => `<a href="https://www.kinopoisk.ru/name/${el.id}">${el?.name || el?.enName}</a>`).join('\n')}`
}

const formatAgent = (agent: MessageAgent, index?: number, agentsListLength?: number) => `${formatHeader(agent, index, agentsListLength)}
${SEPARATOR}
<b>ФИО:</b> ${agent.field_2_s}
<b>Дата рождения:</b> ${agent.field_12_s || DASH}
<b>Основание:</b> ${agent.field_3_s}
<b>Добавлен:</b> ${agent.field_4_s}
<b>Удалён:</b> ${agent.field_5_s || DASH}
<b>Тип:</b> ${agent?.field_7_s}
<b>Описание:</b> ${agent?.description ? agent?.description : DASH}
<b>Ссылки:</b>${formatLinks(agent.field_6_s)}
<b>Кинопоиск:</b>${formatKinopoisk(agent)}`

const shortFormat = (agent: MessageAgent) => `${formatHeader(agent)}
${SEPARATOR}
<b>ФИО:</b> ${agent.field_2_s}
<b>Дата рождения:</b> ${agent.field_12_s || DASH}
<b>Описание:</b> ${agent?.description ? agent?.description : DASH}
<b>Ссылки:</b>${formatLinks(agent.field_6_s)}
<b>Кинопоиск:</b>${formatKinopoisk(agent)}`

export default (options: MessageOptions): string => {
    const {agent, index, agentsList, person} = options
    let newAgent: MessageAgent
    if(agent?.name){
        newAgent = Object.fromEntries(
        Object.entries(agent).map(([key, value]) =>
            renameMap[key] ? [renameMap[key], value] : [key, value]
        )
    ) as MessageAgent
    } else newAgent = agent
    newAgent.person = person
    return options?.isShort
        ? shortFormat(newAgent)
        : formatAgent(newAgent, index, agentsList?.length)
}
