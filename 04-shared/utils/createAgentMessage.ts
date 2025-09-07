
var renameMap = {
    field_number: 'field_1_i',
    name: 'field_2_s',
    article: 'field_3_s',
    adoption_date: 'field_4_s',
    exclusion_date: 'field_5_s',
    domain_name: 'field_6_s',
};
export default (options) => {
    let newAgent
    if(options.agent?.name){
        newAgent = Object.fromEntries(
        Object.entries(options.agent).map(([key, value]) =>
            renameMap[key] ? [renameMap[key], value] : [key, value]
        )
    )
    } else newAgent = options.agent
    const header = options.index ? `<b>Изменение списка</b> (${options.index + 1}/${options.agentsList.length})` : '<b>Найденная информация</b>'
    return `
            ${header}
            
<b>Номер:</b> ${newAgent.field_1_i}
<b>ФИО:</b> ${newAgent.field_2_s}
<b>Основание:</b> ${newAgent.field_3_s}
<b>Дата добавления:</b> ${newAgent.field_4_s}
<b>Дата удаления:</b> ${newAgent.field_5_s ? newAgent.field_5_s : '-'}
<b>Ссылки:</b> ${newAgent.field_6_s ? newAgent.field_6_s.split('; ').map(url => `<a href="${url}">${url}</a>`).join('\n') : '-'}`
}