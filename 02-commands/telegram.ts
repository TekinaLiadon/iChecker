import {IBot} from "./dto";
import {Context} from "telegraf";
import createAgentMessage from "../04-shared/utils/createAgentMessage";
import fetchRetry from "../04-shared/utils/fetchRetry";
import "../04-shared/utils/sharpLibs";
import path from "path";
import {Agent, IAgentDb, IMoviesAgent} from "../02-handlers/dto";
import {AgentKinopoisk, AgentPostgres} from "../02-handlers";
import env from "../04-shared/utils/config";
import {utils, write} from "xlsx";
import sharp from "sharp";

export class TelegramBot implements IBot {
    db: IAgentDb = new AgentPostgres()
    movie: IMoviesAgent = new AgentKinopoisk()
    editDescriptionRequests: Map<number, { id: number; name: string }> = new Map()

    start(ctx: Context): void {
        ctx.reply('Заглушка')
    }

    help(ctx: Context): void {
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

    online(ctx: Context): void {
        ctx.reply('Бот работает');
    }

    getName(ctx: Context): string {
        if (!ctx.message || !('text' in ctx.message)) throw new Error('Введите Фамилию');
        const name: string = ctx.message.text.split(' ').slice(1).join(' ')
        if (!name) throw new Error('Введите Фамилию');
        return name
    }

    getKeyboard(agentNumber: number | undefined, name: string): { text: string; callback_data: string }[][] | undefined {
        if (agentNumber === undefined || agentNumber <= 1) return undefined;

        return Array.from({length: agentNumber > 4 ? 3 : agentNumber - 1}, (el, index) => {
            return [{text: `Вариант ${index + 2}`, callback_data: `agent_${index + 1}_${name}`}]
        })
    }

    async search(ctx: Context, isShort: boolean): Promise<void> {
        try {
            const name: string = this.getName(ctx);
            const agent: Agent = await this.db.getAgentFull(name, 0)
            const keyboard: { text: string; callback_data: string }[][] = [
                ...(this.getKeyboard(agent?.coincidences, name) || []),
                ...this.getDescriptionKeyboard(agent.field_number),
            ]
            const person = await this.movie.getMoviesAgent(agent)

            await this.replyAgentCard(ctx, createAgentMessage({agent, person, isShort}), keyboard, agent?.img)
        } catch (e: any) {
            ctx.reply(e)
        }
    }

    async replyAgentCard(
        ctx: any,
        text: string,
        keyboard: { text: string; callback_data: string }[][],
        img: string | null
    ): Promise<void> {
        if (img && text.length <= 1024) {
            await ctx.replyWithPhoto(
                {source: path.join(process.cwd(), 'uploads', img)},
                {caption: text, parse_mode: 'HTML', reply_markup: {inline_keyboard: keyboard}},
            )
            return
        }

        await ctx.reply(text, {parse_mode: 'HTML', reply_markup: {inline_keyboard: keyboard}})
        if (img) await ctx.replyWithPhoto({source: path.join(process.cwd(), 'uploads', img)})
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
                .reduce((acc: string, el: any) => {
                    return acc + `Фильм: <a href="https://www.kinopoisk.ru/film/${el.id}">${el?.name || 'Неизвестно'}</a>
Роль: ${this.roleTransliteration(el.enProfession)}\n`
                }, '')

            await ctx.reply(movies, {parse_mode: 'HTML', reply_markup: {inline_keyboard: keyboard ?? []},})
        } catch (e: any) {
            ctx.reply(e)
        }
    }

    async addLink(ctx: Context): Promise<void> {
        if (!ctx.message || !('text' in ctx.message)) return
        const [field_number, link] = ctx.message.text.split(' ').slice(1)
        if (!field_number || !link) {
            ctx.reply('Использование: /add_link Номер ссылка');
            return
        }

        const regex = /^https:\/\/www\.kinopoisk\.ru\/name\/(\d+)\/$/u;
        if (!regex.test(link)) {
            ctx.reply('Некоректная ссылка');
            return
        }

        const id = Number(link.split('/').slice(4).join(''))
        const name = await this.db.editLink(id, field_number)

        await ctx.reply(`Обновлена ссылка для ${name}`)
    }

    getDescription(ctx: Context) {
        if (!ctx.message || !('text' in ctx.message)) throw new Error("Нужно выбрать имя агента")
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

            if ((agent?.coincidences ?? 0) > 1)
                throw new Error("Найдено больше одного совпадения, уточните запрос")
            if (!agent)
                throw new Error("Ничего не найдено")

            await this.db.editDescription(agent.id, description)
            ctx.reply(`Описание изменено для ${agent.name}`)
        } catch (e: any) {
            ctx.reply(e)
        }
    }

    async addPhoto(ctx: Context): Promise<void> {
        try {
            const isChat: boolean = ctx.message?.chat.id === env.BOT_CHAT
            if (!isChat) throw new Error('Нет доступа')

            if (!ctx.message || !('caption' in ctx.message)) return
            const textList: string[] = ctx.message.caption?.split(' ') ?? []
            const name = textList.slice(1).join(' ')
            if (textList[0] !== '/edit_photo') return
            if (!name) throw new Error('Нужно выбрать имя агента')

            const agent: Agent = await this.db.getAgentFull(name, 0)
            if (!agent) {
                throw new Error('Агент с такой фамилией не найден')
            }
            if ((agent?.coincidences ?? 0) > 1) {
                throw new Error('Найдено больше одного совпадения, уточните запрос')
            }

            const fileName = await this.savePhoto(ctx, agent.id)
            await this.db.editSrcImg(agent.id, fileName)

            ctx.reply(`Фото изменено для ${agent.name}`)
        } catch (e: any) {
            ctx.reply(e)
        }
    }

    async savePhoto(ctx: Context, name: string | number) {
        const photo = ctx.message && 'photo' in ctx.message ? ctx.message.photo.at(-1) : undefined;
        if (!photo) throw new Error("Фото не найдено")

        const id = photo.file_id
        const file = await ctx.telegram.getFile(id);
        const fileUrl = `https://api.telegram.org/file/bot${env.BOT_TOKEN}/${file.file_path}`;

        const response = await fetchRetry(fileUrl);
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
            const [number, name] = callbackData.split('_').splice(1)
            const agent: Agent = await this.db.getAgentFull(name ?? '', number ?? 0)
            const person = await this.movie.getMoviesAgent(agent)

            await this.replyAgentCard(
                ctx,
                createAgentMessage({agent, person}),
                this.getDescriptionKeyboard(agent.field_number),
                agent?.img,
            )
        } catch (e) {
            ctx.reply(e)
        } finally {
            ctx.answerCbQuery();
        }
    }

    getDescriptionKeyboard(fieldNumber: number): { text: string; callback_data: string }[][] {
        return [[{text: 'Редактирование описания', callback_data: `editdesc_${fieldNumber}`}]]
    }

    async startEditDescription(ctx: any): Promise<void> {
        try {
            const chatId = ctx.callbackQuery?.message?.chat?.id
            if (chatId !== env.BOT_CHAT) {
                ctx.answerCbQuery()
                return
            }

            const [fieldNumber] = ctx.callbackQuery.data.split('_').splice(1)
            const agent: Agent | null = await this.db.getAgentByFieldNumber(Number(fieldNumber))
            if (!agent) {
                ctx.reply('Агент с таким номером не найден')
                ctx.answerCbQuery()
                return
            }

            const message = await ctx.reply(`Отправьте новое описание для ${agent.name} в ответ на это сообщение (до 2000 символов)`,
                {reply_markup: {force_reply: true}})
            this.editDescriptionRequests.set(message.message_id, {id: agent.id, name: agent.name})
            ctx.answerCbQuery()
        } catch (e) {
            ctx.reply(e)
            ctx.answerCbQuery()
        }
    }

    async saveDescription(ctx: any): Promise<void> {
        const promptId: number | undefined = ctx.message?.reply_to_message?.message_id
        if (!promptId) return
        const request = this.editDescriptionRequests.get(promptId)
        if (!request) return
        if (ctx.message.chat.id !== env.BOT_CHAT) return

        this.editDescriptionRequests.delete(promptId)
        try {
            const description: string = ctx.message.text
            if (description.length > 2000) throw new Error("Описание больше 2000 символов")

            await this.db.editDescription(request.id, description)
            ctx.reply(`Описание изменено для ${request.name}`)
        } catch (e) {
            ctx.reply(e)
        } finally {
            try {
                await ctx.telegram.deleteMessage(env.BOT_CHAT, promptId)
            } catch {}
        }
    }
}