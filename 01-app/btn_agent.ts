import getSoloAgent from "../03-entities/agent/getSoloAgent";
import getPersonList from "../03-entities/kinopoisk/getPersonList";
import createAgentMessage from "../04-shared/utils/createAgentMessage";
import {Context} from "telegraf";

export default async (ctx: Context): Promise<void> => {
    const callbackData: string = ctx.callbackQuery.data || '';
    const [number, name]: [number, string] = callbackData.split('_').splice(1)
    const {agent} = await getSoloAgent(name, number)
    let person
    if(agent?.kinopoisk_info) {
        person = agent.kinopoisk_info
    } else person = await getPersonList(agent.name, agent.birthday , agent.id)
    agent ? ctx.reply(createAgentMessage({
        agent,
        person: person === '-' ? person : person,
    }), {parse_mode: 'HTML',}) : ctx.reply('Ничего не найдено')
    ctx.answerCbQuery();
}