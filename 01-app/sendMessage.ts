import checkUpdateAgents from "../03-entities/agent/checkUpdateAgents";
import getPersonList from "../03-entities/kinopoisk/getPersonList";
import createAgentMessage from "../04-shared/utils/createAgentMessage";
import {AgentInfo} from "../03-entities/agent/type";
import {Context, Telegraf} from "telegraf";

export default async (bot: Telegraf<Context>): Promise<void> => {
    const agentsList: AgentInfo[] = await checkUpdateAgents()
    if (agentsList.length === 0) return
    const messageList: string[] = await Promise.all(agentsList.map(async (agent:AgentInfo, index:number): Promise<string> => {
        const person = await getPersonList(agent.field_2_s, agent.field_12_s)
        return createAgentMessage({
            agent,
            index,
            agentsList,
            person,
        })
    }))
    console.log(messageList)
    messageList.forEach((el: string, index: number): void => {
        setTimeout(() => bot.telegram.sendMessage(Bun.env.BOT_CHAT, el, {parse_mode: 'HTML'}), 1000 * index)
    })
}