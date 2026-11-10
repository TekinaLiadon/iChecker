import {test, expect, describe, mock, beforeEach, afterEach} from "bun:test";
import {AgentMinjust} from "./index";
import type {Body} from "./dto";

const originalFetch = global.fetch;

const mockFetchResponse = (pages: { size: number; values: Record<string, unknown>[] }[]) => {
    global.fetch = mock(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(pages[0]),
        })
    ) as unknown as typeof global.fetch;
};

describe("AgentMinjust — getAgent", () => {
    beforeEach(() => {
        mockFetchResponse([{size: 100, values: [{field_1_i: 1, field_2_s: "Иванов"}]}]);
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test("отправляет POST-запрос в реестр", async () => {
        const minjust = new AgentMinjust();

        await minjust.getAgent();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = (global.fetch as unknown as ReturnType<typeof mock>).mock.calls[0] as [
            string,
            RequestInit
        ];
        expect(url).toBe(AgentMinjust.url);
        expect(options.method).toBe("POST");
        expect(options.headers).toEqual({"Content-Type": "application/json"});
    });

    test("тело запроса соответствует структуре Body", async () => {
        const minjust = new AgentMinjust();

        await minjust.getAgent(400);

        const options = (global.fetch as unknown as ReturnType<typeof mock>).mock.calls[0]?.[1] as RequestInit;
        const body: Body = JSON.parse(options.body as string);
        expect(body.offset).toBe(400);
        expect(body.limit).toBe(200);
        expect(body.search).toBe("");
        expect(body.sort).toEqual([{property: "field_1_i", direction: "desc"}]);
    });

    test("offset по умолчанию равен нулю", async () => {
        const minjust = new AgentMinjust();

        await minjust.getAgent();

        const options = (global.fetch as unknown as ReturnType<typeof mock>).mock.calls[0]?.[1] as RequestInit;
        const body: Body = JSON.parse(options.body as string);
        expect(body.offset).toBe(0);
    });

    test("возвращает распарсенный JSON", async () => {
        const minjust = new AgentMinjust();

        const result = await minjust.getAgent();

        expect(result).toEqual({size: 100, values: [{field_1_i: 1, field_2_s: "Иванов"}]});
    });
});

describe("AgentMinjust — getAgentsList", () => {
    afterEach(() => {
        global.fetch = originalFetch;
    });

    test("запрашивает все страницы при размере больше лимита", async () => {
        const page = (offset: number) => ({
            size: 450,
            values: [
                {field_1_i: offset, field_2_s: `Агент ${offset}`},
                {field_1_i: offset + 1, field_2_s: `Агент ${offset + 1}`},
            ],
        });
        global.fetch = mock(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                json: () => {
                    const calls = (global.fetch as unknown as ReturnType<typeof mock>).mock.calls.length;
                    return Promise.resolve(page((calls - 1) * 200));
                },
            })
        ) as unknown as typeof global.fetch;

        const minjust = new AgentMinjust();
        const result = await minjust.getAgentsList();

        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(result).toHaveLength(6);
    });

    test("не запрашивает доп. страницы если данных меньше лимита", async () => {
        mockFetchResponse([{size: 50, values: [{field_1_i: 1, field_2_s: "Один"}]}]);

        const minjust = new AgentMinjust();
        const result = await minjust.getAgentsList();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(1);
    });

    test("ровно одна страница при размере равном лимиту", async () => {
        mockFetchResponse([{size: 200, values: [{field_1_i: 1}]}]);

        const minjust = new AgentMinjust();
        const result = await minjust.getAgentsList();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(1);
    });

    test("оставляет только обязательные поля", async () => {
        mockFetchResponse([
            {
                size: 1,
                values: [
                    {
                        field_1_i: 1,
                        field_2_s: "Иванов",
                        field_3_s: "Основание",
                        field_5_s: "31.12.2025",
                        extra_field: "лишнее",
                        another: 42,
                    },
                ],
            },
        ]);

        const minjust = new AgentMinjust();
        const result = await minjust.getAgentsList();

        expect(result).toEqual([
            {
                field_1_i: 1,
                field_2_s: "Иванов",
                field_3_s: "Основание",
                field_5_s: "31.12.2025",
            },
        ]);
    });

    test("пропусрует обязательные поля, отсутствующие в объекте", async () => {
        mockFetchResponse([
            {
                size: 1,
                values: [{field_1_i: 1, field_2_s: "Иванов"}],
            },
        ]);

        const minjust = new AgentMinjust();
        const result = await minjust.getAgentsList();

        expect(result).toEqual([{field_1_i: 1, field_2_s: "Иванов"}]);
    });

    test("пустой реестр возвращает пустой список", async () => {
        mockFetchResponse([{size: 0, values: []}]);

        const minjust = new AgentMinjust();
        const result = await minjust.getAgentsList();

        expect(result).toEqual([]);
    });

    test("requiredFields содержит нужные ключи", () => {
        expect(AgentMinjust.requiredFields).toContain("field_1_i");
        expect(AgentMinjust.requiredFields).toContain("lastModified_l");
        expect(AgentMinjust.requiredFields).toContain("field_12_s");
    });

    test("url реестра неизменен", () => {
        expect(AgentMinjust.url).toBe(
            "https://reestrs.minjust.gov.ru/rest/registry/39b95df9-9a68-6b6d-e1e3-e6388507067e/values"
        );
    });
});

describe("AgentMinjust — ретраи", () => {
    const retriesOriginalFetch = global.fetch;
    const originalSetTimeout = globalThis.setTimeout;

    afterEach(() => {
        global.fetch = retriesOriginalFetch;
        globalThis.setTimeout = originalSetTimeout;
    });

    test("getAgent ретраит сетевой сбой и возвращает данные", async () => {
        globalThis.setTimeout = ((cb: () => void) => {
            cb();
            return 0 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout;
        let call = 0;
        global.fetch = mock(() => {
            call += 1;
            if (call === 1) return Promise.reject(new Error("сетевой сбой"));
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({size: 0, values: []}),
            });
        }) as unknown as typeof global.fetch;

        const minjust = new AgentMinjust();
        const result = await minjust.getAgent();

        expect(result).toEqual({size: 0, values: []});
        expect(call).toBe(2);
    });

    test("getAgent не ретраит 4xx", async () => {
        global.fetch = mock(() =>
            Promise.resolve({ok: false, status: 404, json: () => Promise.resolve({})})
        ) as unknown as typeof global.fetch;

        const minjust = new AgentMinjust();

        await expect(minjust.getAgent()).rejects.toThrow("HTTP 404");
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});
