import getSoloAgent from "../03-entities/agent/getSoloAgent";
import createAgentMessage from "../04-shared/utils/createAgentMessage";
import {Context} from "telegraf";
import getKinopoiskInfo from "../03-entities/kinopoisk/getKinopoiskInfo";

export default async (ctx: Context): Promise<void> => {
    const callbackData: string = ctx.callbackQuery.data || '';
    const [number, name]: [number, string] = callbackData.split('_').splice(1)
    const {agent} = await getSoloAgent(name, number)
    let person = await getKinopoiskInfo(agent)
    agent ? ctx.reply(createAgentMessage({
        agent,
        person: person === '-' ? person : person,
    }), {parse_mode: 'HTML',}) : ctx.reply('Ничего не найдено')
    ctx.answerCbQuery();
}