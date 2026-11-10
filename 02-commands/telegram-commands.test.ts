import {test, expect, describe, mock, beforeEach, afterEach} from "bun:test";
import {TelegramBot} from "./telegram";
import type {Context} from "telegraf";
import type {Agent} from "../02-handlers/dto";
import * as fs from "fs";
import * as path from "path";

const makeAgent = (overrides: Partial<Agent> = {}): Agent => ({
    id: 1,
    field_number: 42,
    name: "Иванов Иван Иванович",
    article: "Основание",
    adoption_date: "01.01.2020",
    exclusion_date: null,
    domain_name: "https://example.com",
    type_agent: "Физические лица",
    kinopoisk_info: null,
    birthday: "01.01.1980",
    last_modified: 1600000000,
    kinopoisk_id: null,
    kinopoisk_full: null,
    img: null,
    description: "",
    ...overrides,
});

describe("TelegramBot — start/help/online", () => {
    const bot = new TelegramBot();

    test("start: отвечает заглушкой", async () => {
        const ctx = {reply: mock()} as unknown as Context;

        await bot.start(ctx);

        expect(ctx.reply).toHaveBeenCalledWith("Заглушка");
    });

    test("online: подтверждает работу бота", async () => {
        const ctx = {reply: mock()} as unknown as Context;

        await bot.online(ctx);

        expect(ctx.reply).toHaveBeenCalledWith("Бот работает");
    });

    test("help: перечисляет доступные команды", async () => {
        const ctx = {reply: mock()} as unknown as Context;

        await bot.help(ctx);

        const text = (ctx.reply as ReturnType<typeof mock>).mock.calls[0]?.[0] as string;
        expect(text).toContain("/search");
        expect(text).toContain("/table");
        expect(text).toContain("/add_link");
        expect(text).toContain("/edit_description");
    });
});

describe("TelegramBot — search", () => {
    const originalFetch = global.fetch;
    let bot: TelegramBot;

    beforeEach(() => {
        bot = new TelegramBot();
        bot.db = {
            getAgentFull: mock(() => Promise.resolve(makeAgent({coincidences: 1, img: null}))),
        } as unknown as TelegramBot["db"];
        bot.movie = {
            getMoviesAgent: mock(() => Promise.resolve([{id: 1, name: "Кинопоиск"}])),
        } as unknown as TelegramBot["movie"];
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    const makeSearchCtx = () =>
        ({
            message: {text: "/search Иванов"},
            reply: mock(),
            replyWithPhoto: mock(),
        }) as unknown as Context;

    test("полный формат: отвечает сообщением карточки", async () => {
        const ctx = makeSearchCtx();

        await bot.search(ctx, false);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        const [text, options] = (ctx.reply as ReturnType<typeof mock>).mock.calls[0] as [
            string,
            { parse_mode: string }
        ];
        expect(options.parse_mode).toBe("HTML");
        expect(text).toContain("Иванов Иван Иванович");
        expect(ctx.replyWithPhoto).not.toHaveBeenCalled();
    });

    test("короткий формат: отвечает без избыточных полей", async () => {
        const ctx = makeSearchCtx();

        await bot.search(ctx, true);

        const [text] = (ctx.reply as ReturnType<typeof mock>).mock.calls[0] as [string];
        expect(text).not.toContain("<b>Номер:</b>");
    });

    test("без фото: replyWithPhoto не вызывается", async () => {
        bot.db = {
            getAgentFull: mock(() => Promise.resolve(makeAgent({coincidences: 1, img: null}))),
        } as unknown as TelegramBot["db"];
        const ctx = makeSearchCtx();

        await bot.search(ctx, false);

        expect(ctx.replyWithPhoto).not.toHaveBeenCalled();
    });

    test("клавиатура строится при нескольких совпадениях", async () => {
        bot.db = {
            getAgentFull: mock(() => Promise.resolve(makeAgent({coincidences: 3}))),
        } as unknown as TelegramBot["db"];
        const ctx = makeSearchCtx();

        await bot.search(ctx, false);

        const [, options] = (ctx.reply as ReturnType<typeof mock>).mock.calls[0] as [
            string,
            { reply_markup: { inline_keyboard: unknown[][] } }
        ];
        expect(options.reply_markup.inline_keyboard).toHaveLength(3);
        expect(options.reply_markup.inline_keyboard[2]).toEqual([
            {text: "Редактирование описания", callback_data: "editdesc_42"},
        ]);
    });

    test("ошибка парсинга имени уходит в reply", async () => {
        const ctx = {message: {text: "/search"}, reply: mock()} as unknown as Context;

        await bot.search(ctx, false);

        expect(ctx.reply).toHaveBeenCalled();
    });

    test("ошибка БД уходит в reply", async () => {
        bot.db = {
            getAgentFull: mock(() => Promise.reject(new Error("Ничего не найдено"))),
        } as unknown as TelegramBot["db"];
        const ctx = makeSearchCtx();

        await bot.search(ctx, false);

        expect(ctx.reply).toHaveBeenCalled();
    });
});

describe("TelegramBot — searchFilm", () => {
    let bot: TelegramBot;

    beforeEach(() => {
        bot = new TelegramBot();
        bot.db = {
            getAgentFull: mock(() => Promise.resolve(makeAgent({coincidences: 1, kinopoisk_id: 5}))),
        } as unknown as TelegramBot["db"];
        bot.movie = {
            getPersonIdInfo: mock(() =>
                Promise.resolve({
                    movies: [
                        {id: 100, name: "Фильм 1", enProfession: "actor"},
                        {id: 200, name: "Фильм 2", enProfession: "director"},
                    ],
                })
            ),
        } as unknown as TelegramBot["movie"];
    });

    const makeCtx = () =>
        ({
            message: {text: "/search_films Иванов"},
            reply: mock(),
        }) as unknown as Context;

    test("выводит список фильмов с ролями", async () => {
        const ctx = makeCtx();

        await bot.searchFilm(ctx);

        const [text, options] = (ctx.reply as ReturnType<typeof mock>).mock.calls[0] as [
            string,
            { parse_mode: string }
        ];
        expect(options.parse_mode).toBe("HTML");
        expect(text).toContain("Фильм 1");
        expect(text).toContain("Актер");
        expect(text).toContain("Режиссер");
        expect(text).toContain("kinopoisk.ru/film/100");
    });

    test("без kinopoisk_id сообщает об отсутствии профиля", async () => {
        bot.db = {
            getAgentFull: mock(() => Promise.resolve(makeAgent({coincidences: 1, kinopoisk_id: null}))),
        } as unknown as TelegramBot["db"];
        const ctx = makeCtx();

        await bot.searchFilm(ctx);

        const [text] = (ctx.reply as ReturnType<typeof mock>).mock.calls[0] as [string];
        expect(text).toContain("Для иногента не выбран профиль на кинопоиске");
    });

    test("ошибка уходит в reply", async () => {
        bot.db = {
            getAgentFull: mock(() => Promise.reject(new Error("Ничего не найдено"))),
        } as unknown as TelegramBot["db"];
        const ctx = makeCtx();

        await bot.searchFilm(ctx);

        expect(ctx.reply).toHaveBeenCalled();
    });
});

describe("TelegramBot — addLink", () => {
    let bot: TelegramBot;

    beforeEach(() => {
        bot = new TelegramBot();
        bot.db = {
            editLink: mock(() => Promise.resolve("Иванов Иван")),
        } as unknown as TelegramBot["db"];
    });

    const makeCtx = (text: string) =>
        ({
            message: {text},
            reply: mock(),
        }) as unknown as Context;

    test("валидная ссылка обновляет профиль", async () => {
        const ctx = makeCtx("/add_link 42 https://www.kinopoisk.ru/name/12345/");

        await bot.addLink(ctx);

        expect(bot.db.editLink).toHaveBeenCalledWith(12345, "42");
        expect(ctx.reply).toHaveBeenCalledWith("Обновлена ссылка для Иванов Иван");
    });

    test("без аргументов сообщает об использовании", async () => {
        const ctx = makeCtx("/add_link");

        await bot.addLink(ctx);

        expect(ctx.reply).toHaveBeenCalledWith("Использование: /add_link Номер ссылка");
    });

    test("невалидная ссылка отклоняется", async () => {
        const ctx = makeCtx("/add_link 42 https://example.com/name/12345/");

        await bot.addLink(ctx);

        expect(ctx.reply).toHaveBeenCalledWith("Некоректная ссылка");
        expect(bot.db.editLink).not.toHaveBeenCalled();
    });

    test("ссылка без завершающего слеша отклоняется", async () => {
        const ctx = makeCtx("/add_link 42 https://www.kinopoisk.ru/name/12345");

        await bot.addLink(ctx);

        expect(ctx.reply).toHaveBeenCalledWith("Некоректная ссылка");
    });
});

describe("TelegramBot — editDescription", () => {
    let bot: TelegramBot;

    beforeEach(() => {
        bot = new TelegramBot();
        bot.db = {
            getAgentFull: mock(() => Promise.resolve(makeAgent({coincidences: 1}))),
            editDescription: mock(() => Promise.resolve()),
        } as unknown as TelegramBot["db"];
    });

    const makeCtx = (text: string) =>
        ({
            message: {text},
            reply: mock(),
        }) as unknown as Context;

    test("сохраняет описание агента", async () => {
        const ctx = makeCtx("/edit_description Иванов Новое описание");

        await bot.editDescription(ctx);

        expect(bot.db.editDescription).toHaveBeenCalledWith(1, "Новое описание");
        expect(ctx.reply).toHaveBeenCalledWith("Описание изменено для Иванов Иван Иванович");
    });

    test("больше одного совпадения — ошибка", async () => {
        bot.db = {
            getAgentFull: mock(() => Promise.resolve(makeAgent({coincidences: 2}))),
            editDescription: mock(),
        } as unknown as TelegramBot["db"];
        const ctx = makeCtx("/edit_description Иванов описание");

        await bot.editDescription(ctx);

        expect(bot.db.editDescription).not.toHaveBeenCalled();
        const [text] = (ctx.reply as ReturnType<typeof mock>).mock.calls[0] as [string];
        expect(text).toBeInstanceOf(Error);
        expect((text as unknown as Error).message).toContain("больше одного совпадения");
    });

    test("агент не найден — ошибка", async () => {
        bot.db = {
            getAgentFull: mock(() => Promise.reject(new Error("Ничего не найдено"))),
            editDescription: mock(),
        } as unknown as TelegramBot["db"];
        const ctx = makeCtx("/edit_description Несуществующий описание");

        await bot.editDescription(ctx);

        expect(bot.db.editDescription).not.toHaveBeenCalled();
    });
});

describe("TelegramBot — nextAgent", () => {
    let bot: TelegramBot;

    beforeEach(() => {
        bot = new TelegramBot();
        bot.db = {
            getAgentFull: mock(() => Promise.resolve(makeAgent({coincidences: 3}))),
        } as unknown as TelegramBot["db"];
        bot.movie = {
            getMoviesAgent: mock(() => Promise.resolve([{id: 1, name: "Кинопоиск"}])),
        } as unknown as TelegramBot["movie"];
    });

    test("коллбэк agent_N_name: отвечает и подтверждает запрос", async () => {
        const ctx = {
            callbackQuery: {data: "agent_1_Иванов"},
            reply: mock(),
            answerCbQuery: mock(),
        } as unknown as Context;

        await bot.nextAgent(ctx);

        expect(bot.db.getAgentFull).toHaveBeenCalledWith("Иванов", "1");
        expect(ctx.reply).toHaveBeenCalledTimes(1);
        expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    test("answerCbQuery вызывается даже при ошибке", async () => {
        bot.db = {
            getAgentFull: mock(() => Promise.reject(new Error("Ничего не найдено"))),
        } as unknown as TelegramBot["db"];
        const ctx = {
            callbackQuery: {data: "agent_1_Иванов"},
            reply: mock(),
            answerCbQuery: mock(),
        } as unknown as Context;

        await bot.nextAgent(ctx);

        expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    test("пустой коллбэк не падает", async () => {
        const ctx = {
            callbackQuery: {data: ""},
            reply: mock(),
            answerCbQuery: mock(),
        } as unknown as Context;

        await bot.nextAgent(ctx);

        expect(ctx.answerCbQuery).toHaveBeenCalled();
    });
});

describe("TelegramBot — addPhoto", () => {
    const originalEnv = process.env.BOT_CHAT;
    let bot: TelegramBot;

    beforeEach(() => {
        bot = new TelegramBot();
        bot.db = {
            getAgentFull: mock(() => Promise.resolve(makeAgent({coincidences: 1}))),
            editSrcImg: mock(() => Promise.resolve()),
        } as unknown as TelegramBot["db"];
        bot.savePhoto = mock(() => Promise.resolve("1.webp"));
        process.env.BOT_CHAT = "-1003091959045";
    });

    afterEach(() => {
        process.env.BOT_CHAT = originalEnv;
    });

    test("сохраняет фото из разрешённого чата", async () => {
        const ctx = {
            message: {
                chat: {id: -1003091959045},
                caption: "/edit_photo Иванов",
                photo: [{}],
            },
            reply: mock(),
        } as unknown as Context;

        await bot.addPhoto(ctx);

        expect(bot.savePhoto).toHaveBeenCalled();
        expect(bot.db.editSrcImg).toHaveBeenCalledWith(1, "1.webp");
        expect(ctx.reply).toHaveBeenCalledWith("Фото изменено для Иванов Иван Иванович");
    });

    test("чужой чат — отказ в доступе", async () => {
        const ctx = {
            message: {
                chat: {id: "999"},
                caption: "/edit_photo Иванов",
                photo: [{}],
            },
            reply: mock(),
        } as unknown as Context;

        await bot.addPhoto(ctx);

        expect(bot.savePhoto).not.toHaveBeenCalled();
        const [text] = (ctx.reply as ReturnType<typeof mock>).mock.calls[0] as [string];
        expect((text as unknown as Error).message).toBe("Нет доступа");
    });

    test("подпись не та — тихий выход", async () => {
        const ctx = {
            message: {
                chat: {id: -1003091959045},
                caption: "/other_command Иванов",
                photo: [{}],
            },
            reply: mock(),
        } as unknown as Context;

        await bot.addPhoto(ctx);

        expect(bot.savePhoto).not.toHaveBeenCalled();
        expect(ctx.reply).not.toHaveBeenCalled();
    });

    test("без имени — ошибка", async () => {
        const ctx = {
            message: {
                chat: {id: -1003091959045},
                caption: "/edit_photo",
                photo: [{}],
            },
            reply: mock(),
        } as unknown as Context;

        await bot.addPhoto(ctx);

        const [text] = (ctx.reply as ReturnType<typeof mock>).mock.calls[0] as [string];
        expect((text as unknown as Error).message).toBe("Нужно выбрать имя агента");
    });

    test("больше одного совпадения — ошибка", async () => {
        bot.db = {
            getAgentFull: mock(() => Promise.resolve(makeAgent({coincidences: 2}))),
            editSrcImg: mock(),
        } as unknown as TelegramBot["db"];
        const ctx = {
            message: {
                chat: {id: -1003091959045},
                caption: "/edit_photo Иванов",
                photo: [{}],
            },
            reply: mock(),
        } as unknown as Context;

        await bot.addPhoto(ctx);

        expect(bot.db.editSrcImg).not.toHaveBeenCalled();
        const [text] = (ctx.reply as ReturnType<typeof mock>).mock.calls[0] as [string];
        expect((text as unknown as Error).message).toContain("больше одного совпадения");
    });
});

describe("TelegramBot — savePhoto", () => {
    const originalFetch = global.fetch;
    const uploadsDir = path.join(process.cwd(), "uploads");
    let bot: TelegramBot;

    beforeEach(() => {
        bot = new TelegramBot();
        global.fetch = mock(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                arrayBuffer: () =>
                    Promise.resolve(
                        Buffer.from(
                            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="300"><rect width="100%" height="100%" fill="blue"/></svg>'
                        )
                    ),
            })
        ) as unknown as typeof global.fetch;
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, {recursive: true});
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test("скачивает, сжимает и сохраняет webp", async () => {
        const ctx = {
            message: {photo: [{file_id: "abc"}]},
            telegram: {getFile: mock(() => Promise.resolve({file_path: "photos/abc.jpg"}))},
        } as unknown as Context;

        const fileName = await bot.savePhoto(ctx, 77);

        expect(fileName).toBe("77.webp");
        const saved = path.join(uploadsDir, "77.webp");
        expect(fs.existsSync(saved)).toBe(true);
        fs.rmSync(saved, {force: true});
    });

    test("без file_id используется file_unique_id", async () => {
        const ctx = {
            message: {photo: [{file_id: "abc"}]},
            telegram: {getFile: mock(() => Promise.resolve({file_path: "photos/abc.jpg", file_unique_id: "uniq42"}))},
        } as unknown as Context;

        const fileName = await bot.savePhoto(ctx, 0);

        expect(fileName).toBe("uniq42.webp");
        const saved = path.join(uploadsDir, "uniq42.webp");
        expect(fs.existsSync(saved)).toBe(true);
        fs.rmSync(saved, {force: true});
    });

    test("пустой массив фото выбрасывает ошибку", async () => {
        const ctx = {
            message: {photo: []},
            telegram: {getFile: mock()},
        } as unknown as Context;

        await expect(bot.savePhoto(ctx, 1)).rejects.toThrow("Фото не найдено");
    });
});

describe("TelegramBot — createTable", () => {
    let bot: TelegramBot;

    beforeEach(() => {
        bot = new TelegramBot();
        bot.db = {
            getTableAgents: mock(() =>
                Promise.resolve([
                    {
                        Номер: 1,
                        Тип: "Физические лица",
                        Имя: "Иванов Иван",
                        "Причина добавления": "Основание",
                        "День рождение": "01.01.1980",
                        "Дата добавления": "01.01.2020",
                        "Дата удаления": "Не удален/a",
                        "Ссылки на ресурсы": "-",
                        Кинопоиск: "-",
                        Описание: "-",
                    },
                ])
            ),
        } as unknown as TelegramBot["db"];
    });

    test("генерирует xlsx и отправляет документ", async () => {
        const ctx = {replyWithDocument: mock()} as unknown as Context;

        await bot.createTable(ctx);

        const [options] = (ctx.replyWithDocument as ReturnType<typeof mock>).mock.calls[0] as [
            { source: string; filename: string }
        ];
        expect(options.filename).toBe("agents.xlsx");
        expect(fs.existsSync(options.source)).toBe(true);
        expect(options.source.endsWith("uploads/agents.xlsx")).toBe(true);
        fs.rmSync(options.source, {force: true});
    });
});
