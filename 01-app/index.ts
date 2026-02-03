import {Context, Telegraf} from 'telegraf'
import startTask from "../04-shared/utils/startTask";
import createDatabase from "../03-entities/agent/createDatabase";
import checkTime from "../04-shared/utils/checkTime";
import search from "./search";
import searchShort from "./searchShort";
import btn_agent from "./btn_agent";
import sendMessage from "./sendMessage";
import add from "./add";
import help from "../02-commands/help";
import logger from "../04-shared/utils/logger";
import searchFilm from "./searchFilm";
import addLink from "./addLink";
import getTable from "../02-commands/getTable";

const bot: Telegraf<Context> = new Telegraf(Bun.env.BOT_TOKEN)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
var workInterval

const start = async (): Promise<void> => {
    try {
        logger.info("Бот запущен");
        add(bot)
        bot.start((ctx) => ctx.reply('Заглушка'))
        bot.help(help)
        bot.command('online', (ctx) => {
            ctx.reply('Бот работает');
        });
        bot.command('search', search);
        bot.command('search_short', searchShort);
        bot.command('search_films', searchFilm);
        bot.command('add_link', addLink);
        bot.command('table', getTable)
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
        await sendMessage(bot) // Start check
        await bot.launch();
    } catch (err) {
        logger.error(err);
        console.error("При работе произошла ошибка", err);
        process.exit(1);
    }
}
start()

process.once('SIGINT', () => {
    if (workInterval) clearInterval(workInterval)
    bot.stop('SIGINT')
    logger.info('Пользователь завершил работу бота');
    process.exit(0)
})
process.once('SIGTERM', () => {
    if (workInterval) clearInterval(workInterval)
    bot.stop('SIGTERM')
    logger.info('Система завершила работу бота');
    process.exit(0)
})