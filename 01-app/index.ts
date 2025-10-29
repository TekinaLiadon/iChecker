import {Context, Telegraf} from 'telegraf'
import startTask from "../04-shared/utils/startTask";
import createDatabase from "../03-entities/agent/createDatabase";
import checkTime from "../04-shared/utils/checkTime";
import search from "./search";
import btn_agent from "./btn_agent";
import sendMessage from "./sendMessage";

const bot: Telegraf<Context> = new Telegraf(Bun.env.BOT_TOKEN)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
var workInterval

const start = async (): Promise<void> => {
    try {
        console.log("Бот запущен");
        bot.start((ctx) => ctx.reply('Заглушка'))
        bot.help((ctx) => ctx.reply('Есть команды: help, online, search'))
        bot.command('online', (ctx) => {
            ctx.reply('Бот работает');
        });
        bot.command('search', search);
        bot.action(/^agent_/, btn_agent);
        await createDatabase()
        const task = async () => {
            workInterval = setInterval(async () => {
                if (!checkTime()) return
                await sendMessage(bot)
            }, 1800000)
            if (!checkTime()) return
            await sendMessage(bot)
        }
        startTask(task)
        //await sendMessage(bot)
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