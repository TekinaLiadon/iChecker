import { Telegraf } from 'telegraf'
import startTask from "../04-shared/utils/startTask";
import createDatabase from "../03-entities/agent/createDatabase";
import checkTime from "../04-shared/utils/checkTime";
import checkUpdateAgents from "../03-entities/agent/checkUpdateAgents";
import getSoloAgent from "../03-entities/agent/getSoloAgent";
import createAgentMessage from "../04-shared/utils/createAgentMessage";

const bot = new Telegraf(Bun.env.BOT_TOKEN)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
var workInterval

var sendMessage = async () => {
    const agentsList = await checkUpdateAgents()
    if(agentsList.length === 0) return
    const messageList = agentsList.map((agent, index) => {
        return createAgentMessage({
            agent,
            index,
            agentsList,
        })
    })
    messageList.forEach((el, index) => {
        setTimeout(() => bot.telegram.sendMessage(Bun.env.BOT_CHAT, el, { parse_mode: 'HTML' }), 500 * index)
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
                ctx.reply('Использование: /search Имя');
            } else {
                const result = await getSoloAgent(name)
                result ? ctx.reply(createAgentMessage({
                    agent: result
                }), { parse_mode: 'HTML' }) : ctx.reply('Ничего не найдено')
            }
        });
        await createDatabase()
        const task = async () => {
            workInterval = setInterval(async () => {
                if(!checkTime()) return
                await sendMessage()
            }, 3600000)
            if(!checkTime()) return
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
    if(workInterval) clearInterval(workInterval)
    bot.stop('SIGINT')
    console.log('Пользователь завершил работу бота')
    process.exit(0)
})
process.once('SIGTERM', () => {
    if(workInterval) clearInterval(workInterval)
    bot.stop('SIGTERM')
    console.log('Система завершила работу бота')
    process.exit(0)
})