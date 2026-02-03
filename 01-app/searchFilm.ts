import getSoloAgent from "../03-entities/agent/getSoloAgent";
import createAgentMessage from "../04-shared/utils/createAgentMessage";
import {Context} from "telegraf";
import path from "path";
import getPersonIdInfo from "../03-entities/kinopoisk/getPersonIdInfo";
import getKinopoiskInfo from "../03-entities/kinopoisk/getKinopoiskInfo";
import getFullPersonInfo from "../03-entities/kinopoisk/getFullPersonInfo";

type Agent = {
    agent: Record<string, any>;
    number: number;
    name?: string;
    birthday?: string;
    id?: string;
    kinopoisk_info?: any;
}

var roleTransliteration = (role) => {
    return {
        'director': 'Режиссер',
        'actor': 'Актер',
        'writer': 'Сценарист',
        'cameo': 'Камео',
        'design': 'Дизайн'
    }[role] || role
}
export default async (ctx: Context): Promise<void> => {
    const name: string = ctx.message.text.split(' ').slice(1).join(' ')
    if (!name) {
        ctx.reply('Использование: /search_film Фамилия');
        return
    }

    const {agent: result, number}: Agent = await getSoloAgent(name)
    if (!result) {
        ctx.reply('Ничего не найдено')
        return
    }

    let keyboard: { text: string; callback_data: string }[][] | undefined;
    if (number > 1) {
        keyboard = new Array(number > 4 ? 3 : number - 1).fill(null).map((el, index) => {
            return [{text: `Вариант ${index + 2}`, callback_data: `agent_${index + 1}_${name}`}]
        })
    }

    /*if(!result.kinopoisk_id || !result?.kinopoisk_info) {
        const infoNew = await getKinopoiskInfo(result)
        result.kinopoisk_info = infoNew
        if(!infoNew) {
            await ctx.reply('Не найден id кинопоиска')
            return
        }
    }*/

    if(!result.kinopoisk_id) {
        await ctx.reply('Для иногента не выбран профиль на кинопоиске')
        return
    }

    let person = await getFullPersonInfo(result)
    const movies = person.movies
        /*.filter((obj, idx, arr) =>
            idx === arr.findIndex((t) => t.id === obj.id))*/
        .reduce((acc, el) => {
            return acc + `Фильм: <a href="https://www.kinopoisk.ru/film/${el.id}">${el?.name || 'Неизвестно'}</a>
Роль: ${roleTransliteration(el.enProfession)}\n`
        }, '') // TODO лимит

    result ? await ctx.reply(movies, {parse_mode: 'HTML', reply_markup: {inline_keyboard: keyboard},})
        : await ctx.reply('Ничего не найдено')

}