
var renameMap = {
    field_number: 'field_1_i',
    name: 'field_2_s',
    article: 'field_3_s',
    adoption_date: 'field_4_s',
    exclusion_date: 'field_5_s',
    domain_name: 'field_6_s',
};

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
    const header = index ? `<b>Изменение списка</b> (${index + 1}/${agentsList.length})` : '<b>Найденная информация</b>'
    return `
            ${header}
            
<b>Номер:</b> ${newAgent.field_1_i}
<b>ФИО:</b> ${newAgent.field_2_s}
<b>Основание:</b> ${newAgent.field_3_s}
<b>Дата добавления:</b> ${newAgent.field_4_s}
<b>Дата удаления:</b> ${newAgent.field_5_s ? newAgent.field_5_s : '-'}
<b>Ссылки:</b> ${newAgent.field_6_s ? newAgent.field_6_s.split('; ').map(url => `<a href="${url}">${url}</a>`).join('\n') : '-'}
<b>Кинопоиск:</b> ${newAgent.person === '-' || newAgent.person.length === 0 || !newAgent.person
        ? 'Не найдено совпадений по дню рождения' : newAgent.person.map(el => `<a href="https://www.kinopoisk.ru/name/${el.id}">${el.name}</a>`).join('\n')}`
}