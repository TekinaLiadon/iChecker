import getTextCommand from "../04-shared/utils/getTextCommand";
import getSoloAgent from "../03-entities/agent/getSoloAgent";
import {Context} from "telegraf";
import savePhoto from "../04-shared/utils/savePhoto";
import {sql} from "bun";

type Agent = {
    agent: Record<string, any>;
    number: number;
    name?: string;
    birthday?: string;
    id?: string;
    kinopoisk_info?: any;
}
export default (bot): Promise<void> => {
    bot.command('edit_description', async (ctx: Context) => {
        const text = ctx.message.text.split(' ').slice(1)
        const name = text[0]
        const description = text.slice(1).join(' ')

        if(!name) {
            ctx.reply('Нужно выбрать имя агента')
            return
        } else if(description.length > 2000) { // 2048
            ctx.reply('Описание больше 2000 символов')
            return
        }

        const {agent, number}: Agent = await getSoloAgent(name)
        if (!agent && !!number) {
            ctx.reply('Ничего не найдено')
            return
        } else if (number > 1) {
            ctx.reply('Найдено больше одного совпадения, уточните запрос')
            return
        }

        await sql`INSERT INTO info (description, agent_id) VALUES ( ${description}, ${agent.id}) 
        ON CONFLICT (agent_id) DO UPDATE SET
        description = EXCLUDED.description;`


        ctx.reply(`Описание изменено для ${agent.name}`)
    })




    bot.on('photo', async (ctx) => {
        const isChat: boolean = ctx.message.chat.id == Bun.env.BOT_CHAT
        if(!isChat) {
            return ctx.reply('Нет доступа')
        }

        const name = getTextCommand(ctx.message.caption)
        if(ctx.message.caption.split(' ')[0] != '/edit_photo') return
        if(!name) {
            ctx.reply('Нужно выбрать имя агента')
            return
        }

        const {agent, number}: Agent = await getSoloAgent(name)
        if (!agent && !!number) {
            ctx.reply('Агент с такой фамилией не найден')
            return
        } else if (number > 1) {
            ctx.reply('Найдено больше одного совпадения, уточните запрос')
            return
        }

        const fileName = await savePhoto(ctx, agent.id)

        await sql`INSERT INTO info (img, agent_id) VALUES ( ${fileName}, ${agent.id}) 
        ON CONFLICT (agent_id) DO UPDATE SET
        img = EXCLUDED.img;`

        ctx.reply(`Фото изменено для ${agent.name}`)

    });
}