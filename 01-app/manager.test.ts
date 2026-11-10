import {test, expect, describe, mock, afterEach, setSystemTime} from "bun:test";
import AgentsManager from "./manager";
import env from "../04-shared/utils/config";

const makeAgentInfo = (field_1_i: number, field_2_s: string, field_7_s: string = "Физические лица") => ({
    field_1_i,
    field_2_s,
    field_3_s: "",
    field_4_s: "",
    field_5_s: "",
    field_6_s: "",
    field_7_s,
});

const stubHealth = (manager: AgentsManager) => {
    const health = {
        minjust: {failure: mock(), success: mock()},
        kinopoisk: {failure: mock(), success: mock()},
    };
    manager.health = health as unknown as AgentsManager["health"];
    return health;
};

const stubLogger = (manager: AgentsManager) => {
    const error = mock();
    manager.logger = {info: mock(), error} as unknown as AgentsManager["logger"];
    return error;
};

const stubMailing = (
    manager: AgentsManager,
    agentsList: unknown[],
    options: {getAgentsList?: () => Promise<unknown>; getPersonList?: () => Promise<unknown>} = {}
) => {
    manager.agents = {
        getAgentsList: options.getAgentsList ?? (() => Promise.resolve(agentsList)),
    } as unknown as AgentsManager["agents"];
    manager.db = {
        updateAgents: () => Promise.resolve(agentsList),
    } as unknown as AgentsManager["db"];
    manager.movies = {
        getPersonList: options.getPersonList ?? (() => Promise.resolve([])),
    } as unknown as AgentsManager["movies"];
    const sendMessage = mock();
    manager.bot = {telegram: {sendMessage}} as unknown as AgentsManager["bot"];
    globalThis.setTimeout = ((cb: () => void) => {
        cb();
        return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;
    return sendMessage;
};

describe("AgentsManager — checkTime", () => {
    const manager = new AgentsManager();

    test.each([
        ["понедельник 12:00", "2026-09-21T12:00:00", true],
        ["понедельник 21:00", "2026-09-21T21:00:00", true],
        ["вторник 15:30", "2026-09-22T15:30:00", true],
        ["пятница 20:59", "2026-09-25T20:59:00", true],
        ["понедельник 11:59", "2026-09-21T11:59:00", false],
        ["понедельник 22:00", "2026-09-21T22:00:00", false],
        ["суббота 15:00", "2026-09-26T15:00:00", false],
        ["воскресенье 15:00", "2026-09-20T15:00:00", false],
        ["суббота 12:00", "2026-09-26T12:00:00", false],
        ["среда 12:00", "2026-09-23T12:00:00", true],
        ["четверг 21:59", "2026-09-24T21:59:00", true],
        ["четверг 22:00", "2026-09-24T22:00:00", false],
    ])("%s -> %s", (_name, iso, expected) => {
        setSystemTime(new Date(iso));

        expect(manager.checkTime()).toBe(expected);
    });
});

describe("AgentsManager — startTask", () => {
    const manager = new AgentsManager();
    const originalSetTimeout = globalThis.setTimeout;

    afterEach(() => {
        globalThis.setTimeout = originalSetTimeout;
    });

    test("планирует задачу на ближайшую :10 минуту", () => {
        setSystemTime(new Date(2026, 8, 21, 14, 5, 0));
        const scheduled: number[] = [];
        globalThis.setTimeout = ((cb: () => void, delay: number) => {
            scheduled.push(delay);
            return 0 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout;

        manager.startTask(() => {});

        expect(scheduled).toHaveLength(1);
        expect(scheduled[0]).toBe(5 * 60 * 1000);
    });

    test("планирует задачу на ближайшую :40 минуту", () => {
        setSystemTime(new Date(2026, 8, 21, 14, 15, 0));
        const scheduled: number[] = [];
        globalThis.setTimeout = ((cb: () => void, delay: number) => {
            scheduled.push(delay);
            return 0 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout;

        manager.startTask(() => {});

        expect(scheduled).toHaveLength(1);
        expect(scheduled[0]).toBe(25 * 60 * 1000);
    });

    test("выбирает более раннюю из :10 и :40", () => {
        setSystemTime(new Date(2026, 8, 21, 14, 0, 0));
        const scheduled: number[] = [];
        globalThis.setTimeout = ((cb: () => void, delay: number) => {
            scheduled.push(delay);
            return 0 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout;

        manager.startTask(() => {});

        expect(scheduled[0]).toBe(10 * 60 * 1000);
    });

    test("после :40 цель переносится на следующий час", () => {
        setSystemTime(new Date(2026, 8, 21, 14, 45, 0));
        const scheduled: number[] = [];
        globalThis.setTimeout = ((cb: () => void, delay: number) => {
            scheduled.push(delay);
            return 0 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout;

        manager.startTask(() => {});

        expect(scheduled[0]).toBe(25 * 60 * 1000);
    });

    test("вызывает переданную задачу по таймеру", () => {
        setSystemTime(new Date(2026, 8, 21, 14, 5, 0));
        const task = mock();
        globalThis.setTimeout = ((cb: () => void) => {
            cb();
            return 0 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout;

        manager.startTask(task);

        expect(task).toHaveBeenCalledTimes(1);
    });
});

describe("AgentsManager — stop", () => {
    test("очищает интервал и останавливает бота", () => {
        const manager = new AgentsManager();
        manager.workInterval = 42 as unknown as NodeJS.Timeout;
        const botStop = mock();
        manager.bot = {stop: botStop} as unknown as AgentsManager["bot"];

        manager.stop("SIGINT");

        expect(manager.workInterval).toBeNull();
        expect(botStop).toHaveBeenCalledWith("SIGINT");
    });
});

describe("AgentsManager — settingBot", () => {
    test("регистрирует команды и хендлеры", () => {
        const manager = new AgentsManager();
        const registered: string[] = [];
        manager.bot = {
            start: (_h: unknown) => registered.push("start"),
            help: (_h: unknown) => registered.push("help"),
            command: (c: string) => registered.push(`command:${c}`),
            on: (e: string) => registered.push(`on:${e}`),
            action: (_p: unknown) => registered.push("action"),
            launch: () => {},
        } as unknown as AgentsManager["bot"];

        manager.settingBot();

        expect(registered).toContain("start");
        expect(registered).toContain("help");
        expect(registered).toContain("command:online");
        expect(registered).toContain("command:search");
        expect(registered).toContain("command:search_short");
        expect(registered).toContain("command:search_films");
        expect(registered).toContain("command:add_link");
        expect(registered).toContain("command:edit_description");
        expect(registered).toContain("command:table");
        expect(registered).toContain("on:photo");
        expect(registered).toContain("on:text");
        expect(registered).toContain("action");
    });
});

describe("AgentsManager — sendMessage", () => {
    const originalSetTimeout = globalThis.setTimeout;

    afterEach(() => {
        globalThis.setTimeout = originalSetTimeout;
    });

    test("не отправляет сообщения при пустом списке", async () => {
        const manager = new AgentsManager();
        manager.agents = {
            getAgentsList: () => Promise.resolve([]),
        } as unknown as AgentsManager["agents"];
        manager.db = {
            updateAgents: () => Promise.resolve([]),
        } as unknown as AgentsManager["db"];
        const sendMessage = mock();
        manager.bot = {telegram: {sendMessage}} as unknown as AgentsManager["bot"];

        await manager.sendMessage();

        expect(sendMessage).not.toHaveBeenCalled();
    });

    test("отправляет по одному сообщению на агента", async () => {
        const manager = new AgentsManager();
        const agents = [
            {field_1_i: 1, field_2_s: "Иванов", field_3_s: "", field_4_s: "", field_5_s: "", field_6_s: "", field_7_s: ""},
            {field_1_i: 2, field_2_s: "Петров", field_3_s: "", field_4_s: "", field_5_s: "", field_6_s: "", field_7_s: ""},
        ];
        manager.agents = {
            getAgentsList: () => Promise.resolve(agents),
        } as unknown as AgentsManager["agents"];
        manager.db = {
            updateAgents: (list: unknown) => Promise.resolve(list),
        } as unknown as AgentsManager["db"];
        manager.movies = {
            getPersonList: () => Promise.resolve([]),
        } as unknown as AgentsManager["movies"];
        const sendMessage = mock();
        manager.bot = {telegram: {sendMessage}} as unknown as AgentsManager["bot"];
        globalThis.setTimeout = ((cb: () => void) => {
            cb();
            return 0 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout;

        await manager.sendMessage();

        expect(sendMessage).toHaveBeenCalledTimes(2);
    });

    test("отправляет посты с кнопкой редактирования описания", async () => {
        const manager = new AgentsManager();
        const agents = [
            {field_1_i: 11, field_2_s: "Иванов", field_3_s: "", field_4_s: "", field_5_s: "", field_6_s: "", field_7_s: ""},
            {field_1_i: 22, field_2_s: "Петров", field_3_s: "", field_4_s: "", field_5_s: "", field_6_s: "", field_7_s: ""},
        ];
        manager.agents = {
            getAgentsList: () => Promise.resolve(agents),
        } as unknown as AgentsManager["agents"];
        manager.db = {
            updateAgents: (list: unknown) => Promise.resolve(list),
        } as unknown as AgentsManager["db"];
        manager.movies = {
            getPersonList: () => Promise.resolve([]),
        } as unknown as AgentsManager["movies"];
        const sendMessage = mock();
        manager.bot = {telegram: {sendMessage}} as unknown as AgentsManager["bot"];
        globalThis.setTimeout = ((cb: () => void) => {
            cb();
            return 0 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout;

        await manager.sendMessage();

        expect(sendMessage.mock.calls[0]?.[2]?.reply_markup.inline_keyboard).toEqual([
            [{text: "Редактирование описания", callback_data: "editdesc_11"}],
        ]);
        expect(sendMessage.mock.calls[1]?.[2]?.reply_markup.inline_keyboard).toEqual([
            [{text: "Редактирование описания", callback_data: "editdesc_22"}],
        ]);
    });
});

describe("AgentsManager — sendMessage: доступность источников", () => {
    const originalSetTimeout = globalThis.setTimeout;

    afterEach(() => {
        globalThis.setTimeout = originalSetTimeout;
        setSystemTime();
    });

    test("сбой Минюста не роняет прогон: логируется и фиксируется в трекере", async () => {
        const manager = new AgentsManager();
        const health = stubHealth(manager);
        const error = stubLogger(manager);
        stubMailing(manager, [], {getAgentsList: () => Promise.reject(new Error("реестр недоступен"))});

        await manager.sendMessage();

        expect(health.minjust.failure).toHaveBeenCalledTimes(1);
        expect(health.minjust.success).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledWith(expect.objectContaining({message: "реестр недоступен"}));
    });

    test("успешный прогон Минюста фиксируется в трекере", async () => {
        const manager = new AgentsManager();
        const health = stubHealth(manager);
        stubMailing(manager, [makeAgentInfo(1, "Иванов")]);

        await manager.sendMessage();

        expect(health.minjust.success).toHaveBeenCalledTimes(1);
        expect(health.minjust.failure).not.toHaveBeenCalled();
    });

    test("после порога неуспешных прогонов алерт уходит в BOT_CHAT", async () => {
        const manager = new AgentsManager();
        stubLogger(manager);
        const sendMessage = stubMailing(manager, [], {
            getAgentsList: () => Promise.reject(new Error("реестр недоступен")),
        });

        await manager.sendMessage();
        await manager.sendMessage();
        await manager.sendMessage();

        expect(sendMessage).toHaveBeenCalledTimes(1);
        expect(sendMessage).toHaveBeenCalledWith(env.BOT_CHAT, expect.stringContaining("Минюст недоступен уже"));
    });

    test("повторный алерт Минюста в пределах часа не отправляется", async () => {
        const manager = new AgentsManager();
        stubLogger(manager);
        const sendMessage = stubMailing(manager, [], {
            getAgentsList: () => Promise.reject(new Error("реестр недоступен")),
        });

        setSystemTime(new Date("2026-09-21T12:00:00"));
        await manager.sendMessage();
        setSystemTime(new Date("2026-09-21T12:30:00"));
        await manager.sendMessage();
        setSystemTime(new Date("2026-09-21T13:00:00"));
        await manager.sendMessage();
        setSystemTime(new Date("2026-09-21T13:30:00"));
        await manager.sendMessage();

        expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    test("при восстановлении Минюста уходит «снова доступен»", async () => {
        const manager = new AgentsManager();
        stubLogger(manager);
        let fail = true;
        const sendMessage = stubMailing(manager, [makeAgentInfo(1, "Иванов")], {
            getAgentsList: () => (fail ? Promise.reject(new Error("реестр недоступен")) : Promise.resolve([])),
        });

        await manager.sendMessage();
        await manager.sendMessage();
        await manager.sendMessage();
        fail = false;
        await manager.sendMessage();

        expect(sendMessage).toHaveBeenCalledWith(env.BOT_CHAT, "Минюст снова доступен");
    });

    test("сбой Кинопоиска не отменяет рассылку", async () => {
        const manager = new AgentsManager();
        const health = stubHealth(manager);
        const error = stubLogger(manager);
        const agents = [makeAgentInfo(1, "Иванов"), makeAgentInfo(2, "Петров")];
        const sendMessage = stubMailing(manager, agents, {
            getPersonList: () => Promise.reject(new Error("кинопоиск недоступен")),
        });

        await manager.sendMessage();

        expect(sendMessage).toHaveBeenCalledTimes(2);
        expect(health.kinopoisk.failure).toHaveBeenCalledTimes(1);
        expect(health.kinopoisk.success).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledWith(expect.objectContaining({message: "кинопоиск недоступен"}));
    });

    test("успешная проверка Кинопоиска фиксируется в трекере", async () => {
        const manager = new AgentsManager();
        const health = stubHealth(manager);
        stubMailing(manager, [makeAgentInfo(1, "Иванов")], {getPersonList: () => Promise.resolve([])});

        await manager.sendMessage();

        expect(health.kinopoisk.success).toHaveBeenCalledTimes(1);
        expect(health.kinopoisk.failure).not.toHaveBeenCalled();
    });

    test("без новых агентов трекер Кинопоиска не трогается", async () => {
        const manager = new AgentsManager();
        const health = stubHealth(manager);
        manager.agents = {
            getAgentsList: () => Promise.resolve([makeAgentInfo(1, "Иванов")]),
        } as unknown as AgentsManager["agents"];
        manager.db = {
            updateAgents: () => Promise.resolve([]),
        } as unknown as AgentsManager["db"];
        manager.movies = {
            getPersonList: () => Promise.resolve([]),
        } as unknown as AgentsManager["movies"];

        await manager.sendMessage();

        expect(health.kinopoisk.success).not.toHaveBeenCalled();
        expect(health.kinopoisk.failure).not.toHaveBeenCalled();
        expect(health.minjust.success).toHaveBeenCalledTimes(1);
    });

    test("прогон без реальных обращений к Кинопоиску не даёт ложного восстановления", async () => {
        const manager = new AgentsManager();
        const health = stubHealth(manager);
        stubMailing(manager, [makeAgentInfo(1, "ООО Ромашка", "Юридические лица")], {
            getPersonList: () => Promise.resolve("-"),
        });

        await manager.sendMessage();

        expect(health.kinopoisk.success).not.toHaveBeenCalled();
        expect(health.kinopoisk.failure).not.toHaveBeenCalled();
    });

    test("ошибка БД остаётся фатальной для прогона", async () => {
        const manager = new AgentsManager();
        const health = stubHealth(manager);
        stubLogger(manager);
        manager.agents = {
            getAgentsList: () => Promise.resolve([makeAgentInfo(1, "Иванов")]),
        } as unknown as AgentsManager["agents"];
        manager.db = {
            updateAgents: () => Promise.reject(new Error("БД недоступна")),
        } as unknown as AgentsManager["db"];
        manager.movies = {
            getPersonList: () => Promise.resolve([]),
        } as unknown as AgentsManager["movies"];

        await expect(manager.sendMessage()).rejects.toThrow("БД недоступна");
        expect(health.minjust.success).toHaveBeenCalledTimes(1);
    });
});

describe("AgentsManager — prepareDatabase", () => {
    const stubMigrationDb = (
        manager: AgentsManager,
        options: {hasLegacySchema?: boolean; isEmpty?: boolean} = {}
    ) => {
        const db = {
            hasLegacySchema: mock(() => Promise.resolve(options.hasLegacySchema ?? false)),
            isEmpty: mock(() => Promise.resolve(options.isEmpty ?? true)),
            insertAgents: mock(() => Promise.resolve()),
        };
        manager.db = db as unknown as AgentsManager["db"];
        return db;
    };

    const stubMigrator = (manager: AgentsManager, options: {upError?: Error} = {}) => {
        const migrator = {
            up: options.upError
                ? mock(() => Promise.reject(options.upError))
                : mock(() => Promise.resolve({applied: ["8207048194434_2026_10_25_baseline_agents_info.ts"]})),
            mark: mock(() => Promise.resolve({marked: ["8207048194434_2026_10_25_baseline_agents_info.ts"]})),
        };
        manager.migrations = migrator as unknown as AgentsManager["migrations"];
        return migrator;
    };

    test("чистая база: применяется up, пустая схема сидируется реестром", async () => {
        const manager = new AgentsManager();
        const db = stubMigrationDb(manager, {hasLegacySchema: false, isEmpty: true});
        const migrator = stubMigrator(manager);
        manager.agents = {
            getAgentsList: mock(() => Promise.resolve([makeAgentInfo(1, "Иванов")])),
        } as unknown as AgentsManager["agents"];

        await manager.prepareDatabase();

        expect(migrator.up).toHaveBeenCalledTimes(1);
        expect(migrator.up).toHaveBeenCalledWith(expect.objectContaining({databaseUrl: env.POSTGRES_URL}));
        expect(migrator.mark).not.toHaveBeenCalled();
        expect(db.insertAgents).toHaveBeenCalledTimes(1);
        expect(db.insertAgents).toHaveBeenCalledWith([makeAgentInfo(1, "Иванов")]);
    });

    test("заполненная база: первичное сидирование не запускается", async () => {
        const manager = new AgentsManager();
        const db = stubMigrationDb(manager, {hasLegacySchema: false, isEmpty: false});
        const migrator = stubMigrator(manager);
        const getAgentsList = mock(() => Promise.resolve([]));
        manager.agents = {getAgentsList} as unknown as AgentsManager["agents"];

        await manager.prepareDatabase();

        expect(migrator.up).toHaveBeenCalledTimes(1);
        expect(db.insertAgents).not.toHaveBeenCalled();
        expect(getAgentsList).not.toHaveBeenCalled();
    });

    test("легаси-схема прода: baseline через mark без выполнения миграций", async () => {
        const manager = new AgentsManager();
        const db = stubMigrationDb(manager, {hasLegacySchema: true, isEmpty: false});
        const migrator = stubMigrator(manager);
        const getAgentsList = mock(() => Promise.resolve([]));
        manager.agents = {getAgentsList} as unknown as AgentsManager["agents"];

        await manager.prepareDatabase();

        expect(migrator.mark).toHaveBeenCalledTimes(1);
        expect(migrator.mark).toHaveBeenCalledWith(expect.objectContaining({databaseUrl: env.POSTGRES_URL}));
        expect(migrator.up).not.toHaveBeenCalled();
        expect(getAgentsList).not.toHaveBeenCalled();
        expect(db.insertAgents).not.toHaveBeenCalled();
    });

    test("падение миграции пробрасывает ошибку — бот не стартует", async () => {
        const manager = new AgentsManager();
        stubMigrationDb(manager, {hasLegacySchema: false, isEmpty: true});
        stubMigrator(manager, {upError: new Error("миграция не применилась")});
        manager.agents = {
            getAgentsList: () => Promise.resolve([]),
        } as unknown as AgentsManager["agents"];

        await expect(manager.prepareDatabase()).rejects.toThrow("миграция не применилась");
    });
});
