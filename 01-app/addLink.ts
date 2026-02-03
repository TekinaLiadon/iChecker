import {Context} from "telegraf";
import {sql} from "bun";


export default async (ctx: Context): Promise<void> => {
    const [field_number, link, ...rest] = ctx.message.text.split(' ').slice(1)
    if (!field_number || !link) {
        ctx.reply('Использование: /add_link Номер ссылка');
        return
    }

    const regex = /^https:\/\/www\.kinopoisk\.ru\/name\/(\d+)\/$/;
    if (!regex.test(link)) {
        ctx.reply('Некоректная ссылка');
        return
    }

    const id = Number(link.split('/').slice(4).join(''))

    const [{
        name
    }] = await sql`UPDATE agents SET kinopoisk_id = ${id} WHERE field_number = ${field_number} RETURNING name;`

    await ctx.reply(`Обновлена ссылка для ${name}`)
}