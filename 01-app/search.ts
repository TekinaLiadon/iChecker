import getSoloAgent from "../03-entities/agent/getSoloAgent";
import createAgentMessage from "../04-shared/utils/createAgentMessage";
import {Context} from "telegraf";
import getKinopoiskInfo from "../03-entities/kinopoisk/getKinopoiskInfo";
import {sql} from "bun";

type Agent = {
    agent: Record<string, any>;
    number: number;
    name?: string;
    birthday?: string;
    id?: string;
    kinopoisk_info?: any;
}

export default async (ctx: Context): Promise<void> => {
    const name: string = ctx.message.text.split(' ').slice(1).join(' ')
    if (!name) {
        ctx.reply('Использование: /search Фамилия');
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

    let person = await getKinopoiskInfo(result)

    result ? await ctx.reply(createAgentMessage({
        agent: result,
        person: person,
    }), {parse_mode: 'HTML', reply_markup: {inline_keyboard: keyboard},})
        : await ctx.reply('Ничего не найдено')
    if (result.img) await ctx.replyWithPhoto(
        { source: `${Bun.fileURLToPath(new URL('../uploads/', import.meta.url))}${result.img}` },
    );
}