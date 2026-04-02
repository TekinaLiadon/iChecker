import {IBot} from "./dto";
import {Context} from "telegraf";
import createAgentMessage from "../04-shared/utils/createAgentMessage";
import path from "path";
import {Agent, IAgentDb, IMoviesAgent} from "../02-handlers/dto";
import {AgentKinopoisk, AgentPostgres} from "../02-handlers";
import {utils, write} from "xlsx";
import sharp from "sharp";

export class TelegramBot implements IBot {
    db: IAgentDb = new AgentPostgres()
    movie: IMoviesAgent = new AgentKinopoisk()

    async start(ctx: Context): Promise<void> {
        ctx.reply('Заглушка')
    }

    async help(ctx: Context): Promise<void> {
        ctx.reply(`Есть команды: 
/help, 
/online - проверяет доступен ли бот, 
/search (agents) - поиск по фамилии агента, 
/edit_description (agents) (description) - добавление описания агенту, работает по фамилии, 
/edit_photo (agents) - добавление фото агенту. Без фото не работает и так же по фамилии,
/search_short (agents) - выводит только ФИО, Ссылки, Кинопоиск, Описание и Фото
/search_films (agents) - выводит только список фильмов
/add_link (number) (link) - добавляет ссылку на кинопоиск агенту по его номеру
/table - отдает таблицу всех агентов`)
    }

    async online(ctx: Context): Promise<void> {
        ctx.reply('Бот работает');
    }

    getName(ctx: Context): string {
        const name: string = ctx.message.text.split(' ').slice(1).join(' ')
        if (!name) throw new Error('Введите Фамилию');
        return name
    }

    getKeyboard(agentNumber: number, name: string): { text: string; callback_data: string }[][] | undefined {
        if (agentNumber <= 1) return undefined;

        return new Array(agentNumber > 4 ? 3 : agentNumber - 1).fill(null).map((el, index) => {
            return [{text: `Вариант ${index + 2}`, callback_data: `agent_${index + 1}_${name}`}]
        })
    }

    async search(ctx: Context, isShort: boolean): Promise<void> {
        try {
            const name: string = this.getName(ctx);
            const agent: Agent = await this.db.getAgentFull(name, 0)
            const keyboard: {
                text: string;
                callback_data: string
            }[][] | undefined = this.getKeyboard(agent?.coincidences, name)
            const person = await this.movie.getMoviesAgent(agent)

            await ctx.reply(createAgentMessage({
                agent,
                person: person,
                isShort,
            }), {parse_mode: 'HTML', reply_markup: {inline_keyboard: keyboard},})

            if (agent?.img) await ctx.replyWithPhoto(
                {
                    source: path.join(process.cwd(), 'uploads', agent.img),
                },
            )
        } catch (e) {
            ctx.reply(e)
        }
    }

    roleTransliteration(role: string): string {
        return {
            'director': 'Режиссер',
            'actor': 'Актер',
            'writer': 'Сценарист',
            'cameo': 'Камео',
            'design': 'Дизайн'
        }[role] || role
    }

    async searchFilm(ctx: Context): Promise<void> {
        try {
            const name: string = this.getName(ctx);
            const agent: Agent = await this.db.getAgentFull(name, 0)
            const keyboard = this.getKeyboard(agent?.coincidences, name)

            if (!agent.kinopoisk_id) {
                ctx.reply('Для иногента не выбран профиль на кинопоиске')
                return
            }

            const person = await this.movie.getPersonIdInfo(agent)
            const movies = person.movies
                /*.filter((obj, idx, arr) =>
                    idx === arr.findIndex((t) => t.id === obj.id))*/
                .reduce((acc, el) => {
                    return acc + `Фильм: <a href="https://www.kinopoisk.ru/film/${el.id}">${el?.name || 'Неизвестно'}</a>
Роль: ${this.roleTransliteration(el.enProfession)}\n`
                }, '') // TODO лимит

            await ctx.reply(movies, {parse_mode: 'HTML', reply_markup: {inline_keyboard: keyboard},})
        } catch (e) {
            ctx.reply(e)
        }
    }

    async addLink(ctx: Context): Promise<void> {
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
        const name = await this.db.editLink(id, field_number)

        await ctx.reply(`Обновлена ссылка для ${name}`)
    }

    getDescription(ctx: Context) {
        const text = ctx.message.text.split(' ').slice(1)
        const name = text[0]
        const description = text.slice(1).join(' ')

        if (description.length > 2000) throw new Error("Описание больше 2000 символов")
        if (!name) throw new Error("Нужно выбрать имя агента")
        return {
            name,
            description,
        }
    }

    async editDescription(ctx: Context): Promise<void> {
        try {
            const {name, description} = this.getDescription(ctx)
            const agent: Agent = await this.db.getAgentFull(name, 0)

            if (agent?.coincidences > 1)
                throw new Error("Найдено больше одного совпадения, уточните запрос")
            if (!agent && !!agent?.coincidences)
                throw new Error("Ничего не найдено")

            await this.db.editDescription(agent.id, description)
            ctx.reply(`Описание изменено для ${agent.name}`)
        } catch (e) {
            ctx.reply(e)
        }
    }

    async addPhoto(ctx: Context): Promise<void> {
        try {
            const isChat: boolean = ctx.message.chat.id == Bun.env.BOT_CHAT
            if (!isChat) throw new Error('Нет доступа')

            const textList = ctx.message.caption.split(' ')
            const name = textList.slice(1).join(' ')
            if (textList[0] != '/edit_photo') return
            if (!name) throw new Error('Нужно выбрать имя агента')

            const agent: Agent = await this.db.getAgentFull(name, 0)
            if (!agent && !!agent?.coincidences) {
                throw new Error('Агент с такой фамилией не найден')
            }
            if (agent?.coincidences > 1) {
                throw new Error('Найдено больше одного совпадения, уточните запрос')
            }

            const fileName = await this.savePhoto(ctx, agent.id)
            await this.db.editSrcImg(agent.id, fileName)

            ctx.reply(`Фото изменено для ${agent.name}`)
        } catch (e) {
            ctx.reply(e)
        }
    }

    async savePhoto(ctx: Context, name: string | number) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        if (!photo) throw new Error("Фото не найдено")

        const id = photo.file_id
        const file = await ctx.telegram.getFile(id);
        const fileUrl = `https://api.telegram.org/file/bot${Bun.env.BOT_TOKEN}/${file.file_path}`;

        const response = await fetch(fileUrl);
        const buffer = await response.arrayBuffer();
        const webpBuffer = await sharp(buffer)
            .resize({height: 700})
            .webp({quality: 80})
            .toBuffer()

        const fileName = name ? `${name}.webp` : `${file.file_unique_id}.webp`;
        const fullPath = path.join(process.cwd(), 'uploads', fileName);

        await Bun.write(fullPath, webpBuffer)
        return fileName
    }

    async createTable(ctx: Context): Promise<void> {
        const excelSheet = await this.db.getTableAgents();
        const ws = utils.json_to_sheet(excelSheet);
        ws['!cols'] = [
            {wch: 9},
            {wch: 20},
            {wch: 50},
            {wch: 40},
            {wch: 15},
            {wch: 15},
            {wch: 15},
            {wch: 40},
            {wch: 40},
            {wch: 40},
        ];

        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "agentsStats");

        const fullPath = path.join(process.cwd(), 'uploads', "agents.xlsx");
        const excelBuffer = write(wb, {
            bookType: 'xlsx',
            type: 'array',
            compression: true
        });
        await Bun.write(fullPath, excelBuffer);
        await ctx.replyWithDocument({
            source: fullPath,
            filename: 'agents.xlsx'
        });
    }

    async nextAgent(ctx: any): Promise<void> {
        try {
            const callbackData: string = ctx.callbackQuery.data || '';
            const [number, name]: [number, string] = callbackData.split('_').splice(1)
            const agent: Agent = await this.db.getAgentFull(name, number)
            const person = await this.movie.getMoviesAgent(agent)

            ctx.reply(createAgentMessage({
                agent,
                person,
            }), {parse_mode: 'HTML',})
        } catch (e) {
            ctx.reply(e)
        } finally {
            ctx.answerCbQuery();
        }
    }
}