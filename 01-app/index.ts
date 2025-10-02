import {Telegraf} from 'telegraf'
import startTask from "../04-shared/utils/startTask";
import createDatabase from "../03-entities/agent/createDatabase";
import checkTime from "../04-shared/utils/checkTime";
import checkUpdateAgents from "../03-entities/agent/checkUpdateAgents";
import getSoloAgent from "../03-entities/agent/getSoloAgent";
import createAgentMessage from "../04-shared/utils/createAgentMessage";
import getPersonList from "../03-entities/kinopoisk/getPersonList";

const bot = new Telegraf(Bun.env.BOT_TOKEN)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
var workInterval

var sendMessage = async () => {
    const agentsList = await checkUpdateAgents()
    if (agentsList.length === 0) return
    const messageList = await Promise.all(agentsList.map(async (agent, index) => {
        const person = await getPersonList(agent.field_2_s, agent.birthday)
        return createAgentMessage({
            agent,
            index,
            agentsList,
            person,
        })
    }))
    messageList.forEach((el, index) => {
        setTimeout(() => bot.telegram.sendMessage(Bun.env.BOT_CHAT, el, {parse_mode: 'HTML'}), 1000 * index)
    })
}
const start = async (): Promise<void> => {
    try {
        console.log("Бот запущен");
        bot.start((ctx) => ctx.reply('Заглушка при старте'))
        bot.help((ctx) => ctx.reply('Есть команды: help, online, search'))
        bot.command('online', (ctx) => {
            ctx.reply('Бот работает');
        });
        bot.command('search', async (ctx) => {
            const name = ctx.message.text.split(' ').slice(1).join(' ')
            if (!name) {
                ctx.reply('Использование: /search Фамилия');
            } else {
                const {agent: result, number} = await getSoloAgent(name)
                let keyboard
                if (number > 1) {
                    keyboard = new Array(number > 4 ? 3 : number - 1 ).fill(null).map((el, index) => {
                        return [{text: `Вариант ${index + 2}`, callback_data: `agent_${index + 1}_${name}`}]
                    })
                }
                let person
                if(result?.kinopoisk_info) {
                    person = result.kinopoisk_info
                } else person = await getPersonList(result.name, result.birthday ,result.id)
                result ? ctx.reply(createAgentMessage({
                    agent: result,
                    person: person === '-' ? person : person,
                }), {parse_mode: 'HTML', reply_markup: {inline_keyboard: keyboard},}) : ctx.reply('Ничего не найдено')
            }
        });
        bot.action(/^agent_/, async (ctx) => {
            const callbackData = ctx.callbackQuery.data;
            const [number, name] = callbackData.split('_').splice(1)
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
        });
        await createDatabase()
        const task = async () => {
            workInterval = setInterval(async () => {
                if (!checkTime()) return
                await sendMessage()
            }, 3600000)
            if (!checkTime()) return
            await sendMessage()
        }
        startTask(task)
        await bot.launch();
    } catch (err) {
        console.error("Не удалось запустить бота", err);
        process.exit(1);
    }
}
start()

process.once('SIGINT', () => {
    if (workInterval) clearInterval(workInterval)
    bot.stop('SIGINT')
    console.log('Пользователь завершил работу бота')
    process.exit(0)
})
process.once('SIGTERM', () => {
    if (workInterval) clearInterval(workInterval)
    bot.stop('SIGTERM')
    console.log('Система завершила работу бота')
    process.exit(0)
})