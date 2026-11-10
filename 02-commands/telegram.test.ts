import {test, expect, describe, mock, beforeEach, afterEach} from "bun:test";
import {TelegramBot} from "./telegram";
import type {Context} from "telegraf";
import env from "../04-shared/utils/config";

const makeCtx = (text: string): Context =>
    ({
        message: {text},
        reply: mock(),
        replyWithPhoto: mock(),
        replyWithDocument: mock(),
        telegram: {getFile: mock()},
    }) as unknown as Context;

const makeCallbackCtx = (data: string, chatId: number, promptMessageId: number = 123): any =>
    ({
        callbackQuery: {data, message: {chat: {id: chatId}, message_id: 100}},
        reply: mock(() => Promise.resolve({message_id: promptMessageId})),
        answerCbQuery: mock(),
    }) as any;

const makeDescriptionReplyCtx = (
    text: string,
    replyToMessageId: number,
    chatId: number,
    messageId: number = 456
): any =>
    ({
        message: {text, chat: {id: chatId}, message_id: messageId, reply_to_message: {message_id: replyToMessageId}},
        reply: mock(),
        telegram: {deleteMessage: mock(() => Promise.resolve())},
    }) as any;

const mockDb = (agent: unknown): any =>
    ({
        getAgentByFieldNumber: mock(() => Promise.resolve(agent)),
        editDescription: mock(() => Promise.resolve()),
    }) as any;

const agentCard = {
    id: 7,
    field_number: 42,
    name: "Иванов Иван Иванович",
    img: null,
    description: null,
    coincidences: 2,
};

const makeSearchBot = (agent: unknown): TelegramBot => {
    const bot = new TelegramBot();
    bot.db = {getAgentFull: mock(() => Promise.resolve(agent))} as any;
    bot.movie = {getMoviesAgent: mock(() => Promise.resolve([]))} as any;
    return bot;
};

const makeSearchCtx = (text: string): any =>
    ({message: {text}, reply: mock(), replyWithPhoto: mock()}) as any;

describe("TelegramBot — getName", () => {
    const bot = new TelegramBot();

    test("извлекает имя после команды", () => {
        expect(bot.getName(makeCtx("/search Иванов Иван"))).toBe("Иванов Иван");
    });

    test("выбрасывает ошибку при пустом имени", () => {
        expect(() => bot.getName(makeCtx("/search"))).toThrow("Введите Фамилию");
    });

    test("сохраняет пробелы внутри имени", () => {
        expect(bot.getName(makeCtx("/search Иванов  Иван   Иванович"))).toBe("Иванов  Иван   Иванович");
    });
});

describe("TelegramBot — getKeyboard", () => {
    const bot = new TelegramBot();

    test("нет кнопок для одного совпадения", () => {
        expect(bot.getKeyboard(1, "Иванов")).toBeUndefined();
    });

    test("нет кнопок для нуля совпадений", () => {
        expect(bot.getKeyboard(0, "Иванов")).toBeUndefined();
    });

    test("кнопки для двух совпадений", () => {
        const keyboard = bot.getKeyboard(2, "Иванов");

        expect(keyboard).toEqual([
            [{text: "Вариант 2", callback_data: "agent_1_Иванов"}],
        ]);
    });

    test("ограничивает количество кнопок тремя", () => {
        const keyboard = bot.getKeyboard(10, "Иванов");

        expect(keyboard).toHaveLength(3);
        expect(keyboard![0][0].text).toBe("Вариант 2");
        expect(keyboard![2][0].text).toBe("Вариант 4");
        expect(keyboard![2][0].callback_data).toBe("agent_3_Иванов");
    });

    test("callback_data содержит имя", () => {
        const keyboard = bot.getKeyboard(3, "Иванов");

        expect(keyboard![0][0].callback_data).toBe("agent_1_Иванов");
        expect(keyboard![1][0].callback_data).toBe("agent_2_Иванов");
    });
});

describe("TelegramBot — roleTransliteration", () => {
    const bot = new TelegramBot();

    test.each([
        ["director", "Режиссер"],
        ["actor", "Актер"],
        ["writer", "Сценарист"],
        ["cameo", "Камео"],
        ["design", "Дизайн"],
    ])("%s -> %s", (role, expected) => {
        expect(bot.roleTransliteration(role)).toBe(expected);
    });

    test("неизвестная роль возвращается как есть", () => {
        expect(bot.roleTransliteration("producer")).toBe("producer");
    });

    test("пустая роль возвращается как есть", () => {
        expect(bot.roleTransliteration("")).toBe("");
    });
});

describe("TelegramBot — getDescription", () => {
    const bot = new TelegramBot();

    test("извлекает имя и описание", () => {
        const {name, description} = bot.getDescription(makeCtx("/edit_description Иванов Тестовое описание"));

        expect(name).toBe("Иванов");
        expect(description).toBe("Тестовое описание");
    });

    test("описание из нескольких слов", () => {
        const {name, description} = bot.getDescription(makeCtx("/edit_description Иванов очень длинное описание тут"));

        expect(name).toBe("Иванов");
        expect(description).toBe("очень длинное описание тут");
    });

    test("выбрасывает ошибку при отсутствии имени", () => {
        expect(() => bot.getDescription(makeCtx("/edit_description"))).toThrow("Нужно выбрать имя агента");
    });

    test("выбрасывает ошибку при описании длиннее 2000 символов", () => {
        const longDescription = "а".repeat(2001);
        expect(() =>
            bot.getDescription(makeCtx(`/edit_description Иванов ${longDescription}`))
        ).toThrow("Описание больше 2000 символов");
    });

    test("описание ровно 2000 символов проходит", () => {
        const exact = "а".repeat(2000);
        const {description} = bot.getDescription(makeCtx(`/edit_description Иванов ${exact}`));

        expect(description).toBe(exact);
    });
});

describe("TelegramBot — обработка ошибок команд", () => {
    const originalFetch = global.fetch;
    const bot = new TelegramBot();

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test("search: возвращает ошибку при отсутствии имени", async () => {
        const ctx = makeCtx("/search");
        await bot.search(ctx, false);

        expect(ctx.reply).toHaveBeenCalled();
    });
});

describe("TelegramBot — getDescriptionKeyboard", () => {
    const bot = new TelegramBot();

    test("кнопка редактирования описания с номером агента", () => {
        expect(bot.getDescriptionKeyboard(42)).toEqual([
            [{text: "Редактирование описания", callback_data: "editdesc_42"}],
        ]);
    });

    test("callback_data не длиннее 64 байт", () => {
        const keyboard = bot.getDescriptionKeyboard(9999999999);

        expect(Buffer.byteLength(keyboard[0][0].callback_data)).toBeLessThanOrEqual(64);
    });
});

describe("TelegramBot — startEditDescription", () => {
    test("отправляет промпт с force_reply и запоминает агента", async () => {
        const bot = new TelegramBot();
        bot.db = mockDb({id: 7, name: "Иванов Иван Иванович"});
        const ctx = makeCallbackCtx("editdesc_42", env.BOT_CHAT, 123);

        await bot.startEditDescription(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        expect(ctx.reply.mock.calls[0][0]).toContain("Иванов Иван Иванович");
        expect(ctx.reply.mock.calls[0][1]).toEqual({reply_markup: {force_reply: true}});
        expect(bot.editDescriptionRequests.get(123)).toEqual({id: 7, name: "Иванов Иван Иванович"});
        expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    test("игнорирует коллбэк из чужого чата", async () => {
        const bot = new TelegramBot();
        bot.db = mockDb({id: 7, name: "Иванов"});
        const ctx = makeCallbackCtx("editdesc_42", env.BOT_CHAT + 1);

        await bot.startEditDescription(ctx);

        expect(ctx.reply).not.toHaveBeenCalled();
        expect(bot.editDescriptionRequests.size).toBe(0);
        expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    test("сообщает, если агент не найден", async () => {
        const bot = new TelegramBot();
        bot.db = mockDb(null);
        const ctx = makeCallbackCtx("editdesc_42", env.BOT_CHAT);

        await bot.startEditDescription(ctx);

        expect(ctx.reply).toHaveBeenCalledWith("Агент с таким номером не найден");
        expect(bot.editDescriptionRequests.size).toBe(0);
        expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    test("ошибка БД уходит в ctx.reply", async () => {
        const bot = new TelegramBot();
        bot.db = {
            getAgentByFieldNumber: mock(() => Promise.reject(new Error("БД недоступна"))),
        } as any;
        const ctx = makeCallbackCtx("editdesc_42", env.BOT_CHAT);

        await bot.startEditDescription(ctx);

        expect(ctx.reply).toHaveBeenCalled();
        expect(bot.editDescriptionRequests.size).toBe(0);
    });
});

describe("TelegramBot — saveDescription", () => {
    const seedPrompt = (bot: TelegramBot): void => {
        bot.editDescriptionRequests.set(123, {id: 7, name: "Иванов Иван Иванович"});
    };

    test("сохраняет описание агента из ответа на промпт", async () => {
        const bot = new TelegramBot();
        bot.db = mockDb(null);
        seedPrompt(bot);
        const ctx = makeDescriptionReplyCtx("Новое описание", 123, env.BOT_CHAT);

        await bot.saveDescription(ctx);

        expect(bot.db.editDescription).toHaveBeenCalledWith(7, "Новое описание");
        expect(ctx.reply).toHaveBeenCalledWith("Описание изменено для Иванов Иван Иванович");
        expect(bot.editDescriptionRequests.size).toBe(0);
    });

    test("после сохранения удаляет только промпт", async () => {
        const bot = new TelegramBot();
        bot.db = mockDb(null);
        seedPrompt(bot);
        const ctx = makeDescriptionReplyCtx("Новое описание", 123, env.BOT_CHAT, 456);

        await bot.saveDescription(ctx);

        expect(ctx.telegram.deleteMessage).toHaveBeenCalledTimes(1);
        expect(ctx.telegram.deleteMessage).toHaveBeenCalledWith(env.BOT_CHAT, 123);
    });

    test("после сохранения повторный ответ на промпт игнорируется", async () => {
        const bot = new TelegramBot();
        bot.db = mockDb(null);
        seedPrompt(bot);

        await bot.saveDescription(makeDescriptionReplyCtx("Первое", 123, env.BOT_CHAT));
        const second = makeDescriptionReplyCtx("Второе", 123, env.BOT_CHAT, 789);
        await bot.saveDescription(second);

        expect(bot.db.editDescription).toHaveBeenCalledTimes(1);
        expect(bot.db.editDescription).toHaveBeenCalledWith(7, "Первое");
        expect(second.telegram.deleteMessage).not.toHaveBeenCalled();
        expect(second.reply).not.toHaveBeenCalled();
    });

    test("игнорирует сообщение с ответом не на промпт", async () => {
        const bot = new TelegramBot();
        bot.db = mockDb(null);
        seedPrompt(bot);
        const ctx = makeDescriptionReplyCtx("Просто сообщение", 999, env.BOT_CHAT);

        await bot.saveDescription(ctx);

        expect(bot.db.editDescription).not.toHaveBeenCalled();
        expect(ctx.telegram.deleteMessage).not.toHaveBeenCalled();
        expect(bot.editDescriptionRequests.size).toBe(1);
    });

    test("игнорирует сообщение без reply_to_message", async () => {
        const bot = new TelegramBot();
        bot.db = mockDb(null);
        seedPrompt(bot);
        const ctx = {
            message: {text: "Привет", chat: {id: env.BOT_CHAT}},
            reply: mock(),
            telegram: {deleteMessage: mock()},
        } as any;

        await bot.saveDescription(ctx);

        expect(bot.db.editDescription).not.toHaveBeenCalled();
        expect(ctx.telegram.deleteMessage).not.toHaveBeenCalled();
        expect(bot.editDescriptionRequests.size).toBe(1);
    });

    test("игнорирует ответ из чужого чата", async () => {
        const bot = new TelegramBot();
        bot.db = mockDb(null);
        seedPrompt(bot);
        const ctx = makeDescriptionReplyCtx("Новое описание", 123, env.BOT_CHAT + 1);

        await bot.saveDescription(ctx);

        expect(bot.db.editDescription).not.toHaveBeenCalled();
        expect(ctx.telegram.deleteMessage).not.toHaveBeenCalled();
        expect(bot.editDescriptionRequests.size).toBe(1);
    });

    test("отклоняет описание длиннее 2000 символов и чистит за собой", async () => {
        const bot = new TelegramBot();
        bot.db = mockDb(null);
        seedPrompt(bot);
        const ctx = makeDescriptionReplyCtx("а".repeat(2001), 123, env.BOT_CHAT);

        await bot.saveDescription(ctx);

        expect(bot.db.editDescription).not.toHaveBeenCalled();
        expect(ctx.reply).toHaveBeenCalled();
        expect(ctx.telegram.deleteMessage).toHaveBeenCalledTimes(1);
        expect(bot.editDescriptionRequests.size).toBe(0);
    });

    test("описание ровно 2000 символов сохраняется", async () => {
        const bot = new TelegramBot();
        bot.db = mockDb(null);
        seedPrompt(bot);
        const ctx = makeDescriptionReplyCtx("а".repeat(2000), 123, env.BOT_CHAT);

        await bot.saveDescription(ctx);

        expect(bot.db.editDescription).toHaveBeenCalledWith(7, "а".repeat(2000));
        expect(bot.editDescriptionRequests.size).toBe(0);
    });

    test("отказ удаления сообщений не ломает сохранение", async () => {
        const bot = new TelegramBot();
        bot.db = mockDb(null);
        seedPrompt(bot);
        const ctx = makeDescriptionReplyCtx("Новое описание", 123, env.BOT_CHAT);
        ctx.telegram.deleteMessage = mock(() => Promise.reject(new Error("нет прав")));

        await bot.saveDescription(ctx);

        expect(bot.db.editDescription).toHaveBeenCalledWith(7, "Новое описание");
        expect(ctx.reply).toHaveBeenCalledWith("Описание изменено для Иванов Иван Иванович");
    });
});

describe("TelegramBot — кнопка описания в /search", () => {
    test("карточка /search совмещает кнопки вариантов и кнопку описания", async () => {
        const bot = makeSearchBot({...agentCard});
        const ctx = makeSearchCtx("/search Иванов");

        await bot.search(ctx, false);

        expect(ctx.reply.mock.calls[0][1].reply_markup.inline_keyboard).toEqual([
            [{text: "Вариант 2", callback_data: "agent_1_Иванов"}],
            [{text: "Редактирование описания", callback_data: "editdesc_42"}],
        ]);
    });

    test("при одном совпадении — только кнопка описания", async () => {
        const bot = makeSearchBot({...agentCard, coincidences: 1});
        const ctx = makeSearchCtx("/search Иванов");

        await bot.search(ctx, false);

        expect(ctx.reply.mock.calls[0][1].reply_markup.inline_keyboard).toEqual([
            [{text: "Редактирование описания", callback_data: "editdesc_42"}],
        ]);
    });

    test("короткая версия тоже с кнопкой описания", async () => {
        const bot = makeSearchBot({...agentCard, coincidences: 1});
        const ctx = makeSearchCtx("/search_short Иванов");

        await bot.search(ctx, true);

        expect(ctx.reply.mock.calls[0][1].reply_markup.inline_keyboard).toEqual([
            [{text: "Редактирование описания", callback_data: "editdesc_42"}],
        ]);
    });
});

describe("TelegramBot — nextAgent", () => {
    test("карточка выбранного варианта снабжается кнопкой описания", async () => {
        const bot = new TelegramBot();
        bot.db = {getAgentFull: mock(() => Promise.resolve({...agentCard, coincidences: 1}))} as any;
        bot.movie = {getMoviesAgent: mock(() => Promise.resolve([]))} as any;
        const ctx = {
            callbackQuery: {data: "agent_1_Иванов"},
            reply: mock(),
            answerCbQuery: mock(),
        } as any;

        await bot.nextAgent(ctx);

        expect(ctx.reply.mock.calls[0][1].reply_markup.inline_keyboard).toEqual([
            [{text: "Редактирование описания", callback_data: "editdesc_42"}],
        ]);
        expect(ctx.answerCbQuery).toHaveBeenCalled();
    });
});

describe("TelegramBot — фото с кнопкой в карточке", () => {
    test("короткая карточка с фото уходит одним сообщением: фото + подпись + кнопки", async () => {
        const bot = makeSearchBot({...agentCard, coincidences: 1, img: "42.webp"});
        const ctx = makeSearchCtx("/search Иванов");

        await bot.search(ctx, false);

        expect(ctx.reply).not.toHaveBeenCalled();
        expect(ctx.replyWithPhoto).toHaveBeenCalledTimes(1);
        const [source, options] = ctx.replyWithPhoto.mock.calls[0];
        expect(source.source).toContain("42.webp");
        expect(options.caption).toContain("Иванов Иван Иванович");
        expect(options.parse_mode).toBe("HTML");
        expect(options.reply_markup.inline_keyboard).toEqual([
            [{text: "Редактирование описания", callback_data: "editdesc_42"}],
        ]);
    });

    test("длинная карточка с фото: текст с кнопками и фото отдельно", async () => {
        const bot = makeSearchBot({
            ...agentCard,
            coincidences: 1,
            img: "42.webp",
            description: "а".repeat(1100),
        });
        const ctx = makeSearchCtx("/search Иванов");

        await bot.search(ctx, false);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
        expect(ctx.reply.mock.calls[0][1].reply_markup.inline_keyboard).toEqual([
            [{text: "Редактирование описания", callback_data: "editdesc_42"}],
        ]);
        expect(ctx.replyWithPhoto).toHaveBeenCalledTimes(1);
        const [source, options] = ctx.replyWithPhoto.mock.calls[0];
        expect(source.source).toContain("42.webp");
        expect(options?.caption).toBeUndefined();
    });

    test("nextAgent: короткая карточка с фото одним сообщением", async () => {
        const bot = new TelegramBot();
        bot.db = {getAgentFull: mock(() => Promise.resolve({...agentCard, coincidences: 1, img: "42.webp"}))} as any;
        bot.movie = {getMoviesAgent: mock(() => Promise.resolve([]))} as any;
        const ctx = {
            callbackQuery: {data: "agent_1_Иванов"},
            reply: mock(),
            replyWithPhoto: mock(),
            answerCbQuery: mock(),
        } as any;

        await bot.nextAgent(ctx);

        expect(ctx.reply).not.toHaveBeenCalled();
        expect(ctx.replyWithPhoto).toHaveBeenCalledTimes(1);
        const [, options] = ctx.replyWithPhoto.mock.calls[0];
        expect(options.caption).toContain("Иванов Иван Иванович");
        expect(options.reply_markup.inline_keyboard).toEqual([
            [{text: "Редактирование описания", callback_data: "editdesc_42"}],
        ]);
    });
});

describe("TelegramBot — флоу редактирования описания по кнопке", () => {
    test("коллбэк → промпт с force_reply → ответ → editDescription", async () => {
        const bot = new TelegramBot();
        const editDescription = mock(() => Promise.resolve());
        bot.db = {
            getAgentByFieldNumber: mock(() => Promise.resolve({id: 7, name: "Иванов Иван Иванович"})),
            editDescription,
        } as any;
        const promptMessageId = 777;
        const callbackCtx = makeCallbackCtx("editdesc_42", env.BOT_CHAT, promptMessageId);

        await bot.startEditDescription(callbackCtx);

        expect(callbackCtx.reply.mock.calls[0][1]).toEqual({reply_markup: {force_reply: true}});
        expect(bot.editDescriptionRequests.get(promptMessageId)).toEqual({id: 7, name: "Иванов Иван Иванович"});

        const replyCtx = makeDescriptionReplyCtx("Описание из ответа", promptMessageId, env.BOT_CHAT);
        await bot.saveDescription(replyCtx);

        expect(editDescription).toHaveBeenCalledWith(7, "Описание из ответа");
        expect(replyCtx.reply).toHaveBeenCalledWith("Описание изменено для Иванов Иван Иванович");
        expect(replyCtx.telegram.deleteMessage).toHaveBeenCalledTimes(1);
        expect(bot.editDescriptionRequests.size).toBe(0);
    });

    test("чужие сообщения в чате не мешают ответу на промпт", async () => {
        const bot = new TelegramBot();
        const editDescription = mock(() => Promise.resolve());
        bot.db = {
            getAgentByFieldNumber: mock(() => Promise.resolve({id: 7, name: "Иванов Иван Иванович"})),
            editDescription,
        } as any;
        const promptMessageId = 777;

        await bot.startEditDescription(makeCallbackCtx("editdesc_42", env.BOT_CHAT, promptMessageId));

        await bot.saveDescription(makeDescriptionReplyCtx("сообщение мимо", 555, env.BOT_CHAT));
        await bot.saveDescription(({
            message: {text: "не ответ", chat: {id: env.BOT_CHAT}},
            reply: mock(),
        }) as any);

        const replyCtx = makeDescriptionReplyCtx("Нужное описание", promptMessageId, env.BOT_CHAT);
        await bot.saveDescription(replyCtx);

        expect(editDescription).toHaveBeenCalledTimes(1);
        expect(editDescription).toHaveBeenCalledWith(7, "Нужное описание");
    });
});
