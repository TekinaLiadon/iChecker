import {test, expect, describe, mock, beforeEach, afterEach} from "bun:test";
import {AgentKinopoisk} from "./index";
import type {Agent} from "./dto";

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

const originalFetch = global.fetch;

const mockFetch = (response: unknown) => {
    global.fetch = mock(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(response),
        })
    ) as unknown as typeof global.fetch;
};

const mockDb = (kinopoisk: AgentKinopoisk) => {
    const updateKinopoiskInfo = mock();
    kinopoisk.db = {updateKinopoiskInfo} as unknown as AgentKinopoisk["db"];
    return updateKinopoiskInfo;
};

beforeEach(() => {
    mockFetch({docs: []});
});

afterEach(() => {
    global.fetch = originalFetch;
});

describe("AgentKinopoisk — nameCheck", () => {
    const kinopoisk = new AgentKinopoisk();

    test("меняет местами первое и второе слово", () => {
        expect(kinopoisk.nameCheck("Иванов Иван Иванович")).toBe("Иван Иванов");
    });

    test("возвращает '-' для имени не с заглавной буквы", () => {
        expect(kinopoisk.nameCheck("иванов Иван")).toBe("-");
    });

    test("возвращает '-' для фамилии не с заглавной буквы", () => {
        expect(kinopoisk.nameCheck("Иванов иван")).toBe("-");
    });

    test("возвращает '-' для одного слова", () => {
        expect(kinopoisk.nameCheck("Иванов")).toBe("-");
    });

    test("возвращает '-' для пустой строки", () => {
        expect(kinopoisk.nameCheck("")).toBe("-");
    });

    test("возвращает '-' для латиницы с маленькой буквы", () => {
        expect(kinopoisk.nameCheck("ivanov Иван")).toBe("-");
    });

    test("обрабатывает латиницу с заглавной", () => {
        expect(kinopoisk.nameCheck("Smith John")).toBe("John Smith");
    });

    test("кавычки с кириллицей игнорируются, слова меняются местами", () => {
        expect(kinopoisk.nameCheck('Иванов Иван "Средний"')).toBe("Иван Иванов");
    });

    test("кавычки с несколькими кириллическими словами игнорируются", () => {
        expect(kinopoisk.nameCheck('Иванов Иван "Два Слово"')).toBe("Иван Иванов");
    });

    test("кавычки с примечанием в скобках игнорируются", () => {
        expect(kinopoisk.nameCheck('Иванов Иван "Основной (примечание)"')).toBe("Иван Иванов");
    });

    test("пустые кавычки игнорируются", () => {
        expect(kinopoisk.nameCheck('Иванов Иван ""')).toBe("Иван Иванов");
    });

    test("кавычки с цифрами: извлекается цифровая часть", () => {
        expect(kinopoisk.nameCheck('Иванов Иван "Иванов2"')).toBe("2");
    });

    test("обрезает лишние пробелы", () => {
        expect(kinopoisk.nameCheck("  Иванов   Иван  ")).toBe("Иван Иванов");
    });

    test("кавычки до второго слова дают '-' из-за отсутствия фамилии", () => {
        expect(kinopoisk.nameCheck('Иванов "Средний"')).toBe("-");
    });
});

describe("AgentKinopoisk — areDatesEqual", () => {
    const kinopoisk = new AgentKinopoisk();

    test("одинаковые даты в формате DD.MM.YYYY", () => {
        expect(kinopoisk.areDatesEqual("01.01.1980", "01.01.1980")).toBe(true);
    });

    test("разные даты", () => {
        expect(kinopoisk.areDatesEqual("01.01.1980", "02.01.1980")).toBe(false);
    });

    test("ISO-формат равен DD.MM.YYYY", () => {
        expect(kinopoisk.areDatesEqual("1980-01-01T00:00:00Z", "01.01.1980")).toBe(true);
    });

    test("некорректная первая дата — считаем равным", () => {
        expect(kinopoisk.areDatesEqual("не дата", "01.01.1980")).toBe(true);
    });

    test("некорректная вторая дата — не равны", () => {
        expect(kinopoisk.areDatesEqual("01.01.1980", "не дата")).toBe(false);
    });

    test("обе даты некорректны", () => {
        expect(kinopoisk.areDatesEqual("не дата", "тоже не дата")).toBe(true);
    });

    test("null-даты обрабатываются", () => {
        expect(kinopoisk.areDatesEqual(null, "01.01.1980")).toBe(true);
    });

    test("сравнение с объектом Date", () => {
        expect(kinopoisk.areDatesEqual(new Date(Date.UTC(1980, 0, 1)), "01.01.1980")).toBe(true);
    });

    test("формат DD.MM.YYYY из двух частей не падает", () => {
        expect(kinopoisk.areDatesEqual("01.01", "01.01.1980")).toBe(false);
    });

    test("часовой пояс не влияет на сравнение дней", () => {
        expect(kinopoisk.areDatesEqual("1980-01-01T23:00:00Z", "01.01.1980")).toBe(true);
    });
});

describe("AgentKinopoisk — getMoviesAgent", () => {
    test("возвращает кэш если он актуален", async () => {
        const kinopoisk = new AgentKinopoisk();
        mockDb(kinopoisk);
        const cached = [{id: 1, name: "Кешированный", timestamp: Date.now()}];
        const agent = makeAgent({kinopoisk_info: cached});

        const result = await kinopoisk.getMoviesAgent(agent);

        expect(result).toBe(cached);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("обновляет данные если кэш устарел", async () => {
        const kinopoisk = new AgentKinopoisk();
        const updateKinopoiskInfo = mockDb(kinopoisk);
        const stale = [{id: 1, name: "Старый", timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000}];
        const agent = makeAgent({kinopoisk_info: stale});

        mockFetch({docs: [{id: 2, name: "Новый", birthday: "1980-01-01"}]});
        const result = await kinopoisk.getMoviesAgent(agent);

        expect(global.fetch).toHaveBeenCalled();
        expect(Array.isArray(result)).toBe(true);
        expect(updateKinopoiskInfo).toHaveBeenCalled();
    });

    test("устаревший кэш на границе 30 дней считается актуальным", async () => {
        const kinopoisk = new AgentKinopoisk();
        mockDb(kinopoisk);
        const boundary = [{id: 1, timestamp: Date.now() - 29 * 24 * 60 * 60 * 1000}];
        const agent = makeAgent({kinopoisk_info: boundary});

        const result = await kinopoisk.getMoviesAgent(agent);

        expect(result).toBe(boundary);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("отсутствующий kinopoisk_info запрашивается через API", async () => {
        const kinopoisk = new AgentKinopoisk();
        const updateKinopoiskInfo = mockDb(kinopoisk);
        const agent = makeAgent({kinopoisk_info: null});
        mockFetch({docs: [{id: 2, name: "Новый", birthday: "1980-01-01"}]});

        const result = await kinopoisk.getMoviesAgent(agent);

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(Array.isArray(result)).toBe(true);
        expect(updateKinopoiskInfo).toHaveBeenCalledWith(1, expect.any(Array));
    });

    test("пустой массив kinopoisk_info запрашивается через API", async () => {
        const kinopoisk = new AgentKinopoisk();
        mockDb(kinopoisk);
        const agent = makeAgent({kinopoisk_info: []});
        mockFetch({docs: []});

        await kinopoisk.getMoviesAgent(agent);

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});

describe("AgentKinopoisk — getPersonList", () => {
    test("возвращает '-' для юридических лиц", async () => {
        const kinopoisk = new AgentKinopoisk();

        const result = await kinopoisk.getPersonList("Иванов Иван", "01.01.1980", "Юридические лица", 1);

        expect(result).toBe("-");
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("возвращает '-' если nameCheck отклонил имя", async () => {
        const kinopoisk = new AgentKinopoisk();

        const result = await kinopoisk.getPersonList("иванов иван", "01.01.1980", "Физические лица", 1);

        expect(result).toBe("-");
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("фильтрует результаты по дате рождения", async () => {
        const kinopoisk = new AgentKinopoisk();
        mockDb(kinopoisk);
        mockFetch({
            docs: [
                {id: 1, name: "Совпадение", birthday: "1980-01-01"},
                {id: 2, name: "Другая дата", birthday: "1990-05-05"},
            ],
        });

        const result = await kinopoisk.getPersonList("Иванов Иван", "01.01.1980", "Физические лица", null);

        expect(result).toHaveLength(1);
        expect((result as Array<{ name: string }>)[0]?.name).toBe("Совпадение");
    });

    test("возвращает пустой массив если нет совпадений", async () => {
        const kinopoisk = new AgentKinopoisk();
        mockDb(kinopoisk);
        mockFetch({docs: [{id: 1, name: "Другая дата", birthday: "1990-05-05"}]});

        const result = await kinopoisk.getPersonList("Иванов Иван", "01.01.1980", "Физические лица", null);

        expect(result).toEqual([]);
    });

    test("сохраняет результат в БД при наличии id", async () => {
        const kinopoisk = new AgentKinopoisk();
        const updateKinopoiskInfo = mockDb(kinopoisk);
        mockFetch({docs: [{id: 1, name: "Совпадение", birthday: "1980-01-01"}]});

        await kinopoisk.getPersonList("Иванов Иван", "01.01.1980", "Физические лица", 77);

        expect(updateKinopoiskInfo).toHaveBeenCalledTimes(1);
        const [id, saved] = updateKinopoiskInfo.mock.calls[0] ?? [];
        expect(id).toBe(77);
        expect(saved[0].timestamp).toBeDefined();
    });

    test("не сохраняет в БД без id", async () => {
        const kinopoisk = new AgentKinopoisk();
        const updateKinopoiskInfo = mockDb(kinopoisk);
        mockFetch({docs: [{id: 1, name: "Совпадение", birthday: "1980-01-01"}]});

        await kinopoisk.getPersonList("Иванов Иван", "01.01.1980", "Физические лица", null);

        expect(updateKinopoiskInfo).not.toHaveBeenCalled();
    });

    test("передаёт query в URL поиска", async () => {
        const kinopoisk = new AgentKinopoisk();
        mockDb(kinopoisk);
        mockFetch({docs: []});

        await kinopoisk.getPersonList("Иванов Иван", "01.01.1980", "Физические лица", null);

        const url = (global.fetch as unknown as ReturnType<typeof mock>).mock.calls[0]?.[0] as string;
        expect(url).toContain("api.kinopoisk.dev/v1.4/person/search");
        expect(url).toContain("query=");
    });

    test("ретраит 502 и возвращает данные после восстановления", async () => {
        globalThis.setTimeout = ((cb: () => void) => {
            cb();
            return 0 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout;
        const kinopoisk = new AgentKinopoisk();
        mockDb(kinopoisk);
        let call = 0;
        global.fetch = mock(() => {
            call += 1;
            if (call === 1) return Promise.resolve({ok: false, status: 502});
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({docs: [{id: 1, name: "Совпадение", birthday: "1980-01-01"}]}),
            });
        }) as unknown as typeof global.fetch;

        const result = await kinopoisk.getPersonList("Иванов Иван", "01.01.1980", "Физические лица", null);

        expect(result).toHaveLength(1);
        expect(call).toBe(2);
        global.fetch = originalFetch;
    });
});

describe("AgentKinopoisk — getPersonIdInfo", () => {
    test("свежий kinopoisk_full возвращается из кэша без запроса к API", async () => {
        const kinopoisk = new AgentKinopoisk();
        const updateKinopoiskInfo = mockDb(kinopoisk);
        const cached = {id: 5, name: "Из кэша", timestamp: Date.now()};
        const agent = makeAgent({kinopoisk_full: cached, kinopoisk_id: 5});

        const result = await kinopoisk.getPersonIdInfo(agent);

        expect(result).toBe(cached);
        expect(global.fetch).not.toHaveBeenCalled();
        expect(updateKinopoiskInfo).not.toHaveBeenCalled();
    });

    test("запрашивает API если кэш устарел", async () => {
        const kinopoisk = new AgentKinopoisk();
        mockDb(kinopoisk);
        const agent = makeAgent({
            kinopoisk_full: {id: 5, timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000},
            kinopoisk_id: 5,
        });
        mockFetch({id: 5, name: "Из API"});

        const result = await kinopoisk.getPersonIdInfo(agent);

        expect(global.fetch).toHaveBeenCalled();
        expect((result as { name: string }).name).toBe("Из API");
    });

    test("сохраняет свежий результат в БД", async () => {
        const kinopoisk = new AgentKinopoisk();
        const updateKinopoiskInfo = mockDb(kinopoisk);
        const agent = makeAgent({
            kinopoisk_full: {id: 5, timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000},
            kinopoisk_id: 5,
            id: 3,
        });
        mockFetch({id: 5, name: "Из API"});

        await kinopoisk.getPersonIdInfo(agent);

        expect(updateKinopoiskInfo).toHaveBeenCalledWith(3, expect.objectContaining({timestamp: expect.any(Number)}));
    });

    test("null kinopoisk_full запрашивается через API", async () => {
        const kinopoisk = new AgentKinopoisk();
        mockDb(kinopoisk);
        const agent = makeAgent({kinopoisk_full: null, kinopoisk_id: 9});
        mockFetch({id: 9, name: "Из API"});

        const result = await kinopoisk.getPersonIdInfo(agent);

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect((result as { name: string }).name).toBe("Из API");
    });
});

describe("AgentKinopoisk — getPersonInfo", () => {
    test("возвращает данные без сохранения без personId", async () => {
        const kinopoisk = new AgentKinopoisk();
        const updateKinopoiskInfo = mockDb(kinopoisk);
        mockFetch({id: 42, name: "Данные"});

        const result = await kinopoisk.getPersonInfo(42, 0);

        expect((result as { name: string }).name).toBe("Данные");
        expect(updateKinopoiskInfo).not.toHaveBeenCalled();
    });

    test("добавляет timestamp и сохраняет при personId", async () => {
        const kinopoisk = new AgentKinopoisk();
        const updateKinopoiskInfo = mockDb(kinopoisk);
        mockFetch({id: 42, name: "Данные"});

        const result = await kinopoisk.getPersonInfo(42, 7);

        expect(result.timestamp).toBeDefined();
        expect(updateKinopoiskInfo).toHaveBeenCalledWith(7, expect.objectContaining({timestamp: expect.any(Number)}));
    });

    test("передаёт id в URL запроса", async () => {
        const kinopoisk = new AgentKinopoisk();
        mockDb(kinopoisk);
        mockFetch({id: 42, name: "Данные"});

        await kinopoisk.getPersonInfo(42, 0);

        const url = (global.fetch as unknown as ReturnType<typeof mock>).mock.calls[0]?.[0] as string;
        expect(url).toBe("https://api.kinopoisk.dev/v1.4/person/42");
    });
});
