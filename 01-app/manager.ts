import {Context, Telegraf} from "telegraf";
import {markMigrationsApplied, migrateUp} from "bunsql-native-migrate";
import {IBot} from "../02-commands/dto";
import {TelegramBot} from "../02-commands/telegram";
import {IAgentDb, IAgentInfo, AgentInfo, IMoviesAgent} from "../02-handlers/dto";
import {AgentKinopoisk, AgentMinjust, AgentPostgres} from "../02-handlers";
import createAgentMessage from "../04-shared/utils/createAgentMessage";
import {SourceHealthTracker} from "../04-shared/utils/sourceHealth";
import {FabricLogger, ILogger} from "../04-shared/utils/logger";
import env from "../04-shared/utils/config";

export default class AgentsManager {
    bot: Telegraf<Context> = new Telegraf(env.BOT_TOKEN)
    logger: ILogger = FabricLogger.createLogger()
    commands: IBot = new TelegramBot()
    db: IAgentDb = new AgentPostgres()
    agents: IAgentInfo = new AgentMinjust()
    movies: IMoviesAgent = new AgentKinopoisk()
    health = {
        minjust: new SourceHealthTracker({name: "Минюст", notify: (text) => this.alert(text)}),
        kinopoisk: new SourceHealthTracker({name: "Кинопоиск", notify: (text) => this.alert(text)}),
    }
    migrations = {
        up: migrateUp,
        mark: markMigrationsApplied,
    }
    workInterval: NodeJS.Timeout | null = null

    async startService(): Promise<void> {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        this.logger.info("Бот запущен");

        await this.prepareDatabase()

        this.settingBot()
        await this.createTask()
        await this.bot.launch();
    }

    async prepareDatabase(): Promise<void> {
        const databaseUrl = env.POSTGRES_URL
        if (await this.db.hasLegacySchema()) {
            await this.migrations.mark({databaseUrl})
            this.logger.info("Найдена схема без истории миграций — применён baseline без выполнения миграций")
            return
        }
        const {applied} = await this.migrations.up({databaseUrl})
        if (applied.length > 0) this.logger.info(`Применены миграции: ${applied.join(", ")}`)
        if (await this.db.isEmpty()) {
            await this.db.insertAgents(await this.agents.getAgentsList())
        }
    }

    settingBot() {
        this.bot.start(this.commands.start)
        this.bot.help(this.commands.help)
        this.bot.command('online', this.commands.help);
        this.bot.command('search',
            (ctx) => this.commands.search.bind(this.commands)(ctx, false));
        this.bot.command('search_short',
            (ctx) => this.commands.search.bind(this.commands)(ctx, true));
        this.bot.command('search_films', this.commands.searchFilm.bind(this.commands));
        this.bot.command('add_link', this.commands.addLink.bind(this.commands));
        this.bot.command('edit_description', this.commands.editDescription.bind(this.commands))
        this.bot.on('photo', this.commands.addPhoto.bind(this.commands))
        this.bot.command('table', this.commands.createTable.bind(this.commands));
        this.bot.action(/^agent_/, this.commands.nextAgent.bind(this.commands));
        this.bot.action(/^editdesc_/, this.commands.startEditDescription.bind(this.commands));
        this.bot.on('text', this.commands.saveDescription.bind(this.commands));
    }

    async createTask() {
        await this.sendMessage() // Start check
        const task = async () => {
            if (!this.checkTime()) return
            await this.sendMessage()
        }
        this.startTask(() => {
            task()
            this.workInterval = setInterval(task, 1800000)
        })
    }

    checkTime(): boolean {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        return hour >= 12 && hour <= 21 && day >= 1 && day <= 5;
    }

    startTask(task: () => void): void {
        const now = new Date();
        let target10 = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            now.getHours(),
            10,
            0,
            0
        );
        if (now >= target10) {
            target10 = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                now.getHours() + 1,
                10,
                0,
                0
            );
        }

        let target40 = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            now.getHours(),
            40,
            0,
            0
        );
        if (now >= target40) {
            target40 = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                now.getHours() + 1,
                40,
                0,
                0
            );
        }

        const nextTarget = target10 < target40 ? target10 : target40;
        const delay = nextTarget.getTime() - now.getTime();
        setTimeout(() => {
            task();
        }, delay);
    }

    async alert(text: string): Promise<void> {
        try {
            await this.bot.telegram.sendMessage(env.BOT_CHAT, text)
        } catch (e) {
            this.logger.error(e)
        }
    }

    async sendMessage() {
        let fullAgentsList: AgentInfo[]
        try {
            fullAgentsList = await this.agents.getAgentsList()
        } catch (e) {
            this.logger.error(e)
            await this.health.minjust.failure()
            return
        }
        await this.health.minjust.success()

        const agentsList: AgentInfo[] = await this.db.updateAgents(fullAgentsList)
        if (agentsList.length === 0) return

        let kinopoiskFailures = 0
        let kinopoiskChecks = 0
        const messageList: string[] = await Promise.all(agentsList.map(async (agent: AgentInfo, index: number): Promise<string> => {
            let person
            try {
                person = await this.movies.getPersonList(agent.field_2_s, agent.field_12_s, agent.field_7_s, null)
            } catch (e) {
                this.logger.error(e)
                person = '-'
                kinopoiskFailures += 1
            }
            if (person !== '-') kinopoiskChecks += 1
            return createAgentMessage({
                agent,
                index,
                agentsList,
                person,
            })
        }))
        if (kinopoiskFailures > 0) await this.health.kinopoisk.failure()
        else if (kinopoiskChecks > 0) await this.health.kinopoisk.success()

        messageList.forEach((el: string, index: number): void => {
            setTimeout(() => this.bot.telegram.sendMessage(env.BOT_CHAT, el, {
                parse_mode: 'HTML',
                reply_markup: {inline_keyboard: this.commands.getDescriptionKeyboard(agentsList[index].field_1_i)},
            }), 1000 * index)
        })
    }

    stop(type: string) {
        this.workInterval = null
        this.bot.stop(type)
    }
}