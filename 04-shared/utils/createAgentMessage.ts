
var renameMap = {
    field_number: 'field_1_i',
    name: 'field_2_s',
    article: 'field_3_s',
    adoption_date: 'field_4_s',
    exclusion_date: 'field_5_s',
    domain_name: 'field_6_s',
    type_agent: 'field_7_s',
    description: 'description',
};

const formatAgent = (agent, index, agentsListLength) => {
    const header = index ? `<b>Изменение списка</b> (${index + 1}/${agentsListLength})` : '<b>Найденная информация</b>'
    const links = agent.field_6_s
        ? agent.field_6_s.split('; ').map(url => `<a href="${url}">${url}</a>`).join('\n')
        : '-';

    const kinopoisk = !agent.person || agent.person === '-' || agent.person.length === 0
        ? 'Не найдено совпадений по дню рождения'
        : agent.person.map(el => `<a href="https://www.kinopoisk.ru/name/${el.id}">${el?.name || el?.enName}</a>`).join('\n');
    return `
        ${header}
<b>Номер:</b> ${agent.field_1_i}
<b>ФИО:</b> ${agent.field_2_s}
<b>Основание:</b> ${agent.field_3_s}
<b>Дата добавления:</b> ${agent.field_4_s}
<b>Дата удаления:</b> ${agent.field_5_s || '-'}
<b>Ссылки:</b> ${links}
<b>Тип агента:</b> ${agent?.field_7_s}
<b>Описание:</b> ${agent?.description ? agent?.description : '-'}
<b>Кинопоиск:</b> ${kinopoisk}`;
}

export default (options): string => {
    const {agent, index, agentsList, person} = options
    let newAgent
    if(agent?.name){
        newAgent = Object.fromEntries(
        Object.entries(agent).map(([key, value]) =>
            renameMap[key] ? [renameMap[key], value] : [key, value]
        )
    )
    } else newAgent = agent
    newAgent.person = person
    return formatAgent(newAgent, index, agentsList?.length)
}