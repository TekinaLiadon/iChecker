import {test, expect, describe, mock, beforeEach, afterEach} from "bun:test";
import fetchRetry, {
    getRetryDelayMs,
    isRetryableStatus,
    RETRY_BASE_DELAY_MS,
    RETRY_MAX_ATTEMPTS,
} from "./fetchRetry";

const originalFetch = global.fetch;
const originalSetTimeout = globalThis.setTimeout;
const originalRandom = Math.random;

const jsonResponse = (status: number) => ({ok: status >= 200 && status < 300, status});

const runWithImmediateTimers = (capture?: number[]) => {
    globalThis.setTimeout = ((cb: () => void, delay: number) => {
        if (capture) capture.push(delay);
        cb();
        return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;
};

const mockFetchSequence = (steps: (() => Promise<unknown>)[]) => {
    let call = 0;
    global.fetch = mock(() => {
        const step = steps[Math.min(call, steps.length - 1)];
        call += 1;
        return step();
    }) as unknown as typeof global.fetch;
    return call;
};

beforeEach(() => {
    Math.random = () => 0.5;
    runWithImmediateTimers();
});

afterEach(() => {
    global.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    Math.random = originalRandom;
});

describe("isRetryableStatus", () => {
    test.each([
        [429, true],
        [500, true],
        [502, true],
        [503, true],
        [599, true],
        [400, false],
        [401, false],
        [404, false],
        [418, false],
    ])("%i -> %s", (status, expected) => {
        expect(isRetryableStatus(status)).toBe(expected);
    });
});

describe("getRetryDelayMs", () => {
    test("растёт экспоненциально", () => {
        expect(getRetryDelayMs(0)).toBe(750);
        expect(getRetryDelayMs(1)).toBe(1500);
        expect(getRetryDelayMs(2)).toBe(3000);
    });

    test("джиттер укладывает задержку между половиной и полным backoff", () => {
        Math.random = () => 0;
        expect(getRetryDelayMs(0)).toBe(500);
        Math.random = () => 1;
        expect(getRetryDelayMs(0)).toBe(1000);
    });

    test("база задержки настраивается", () => {
        expect(getRetryDelayMs(1, 200)).toBe(300);
    });
});

describe("fetchRetry", () => {
    test("константы по умолчанию: 3 попытки, база 1000 мс", () => {
        expect(RETRY_MAX_ATTEMPTS).toBe(3);
        expect(RETRY_BASE_DELAY_MS).toBe(1000);
    });

    test("возвращает ok-ответ без повторов", async () => {
        mockFetchSequence([() => Promise.resolve(jsonResponse(200))]);

        const response = await fetchRetry("https://example.com");

        expect(response.status).toBe(200);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test("передаёт url и init в fetch", async () => {
        mockFetchSequence([() => Promise.resolve(jsonResponse(200))]);
        const init = {method: "POST", headers: {"Content-Type": "application/json"}};

        await fetchRetry("https://example.com", init);

        const [url, options] = (global.fetch as unknown as ReturnType<typeof mock>).mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://example.com");
        expect(options).toEqual(init);
    });

    test.each([400, 401, 404, 418])("4xx (%i) падает сразу без ретраев", async (status) => {
        mockFetchSequence([() => Promise.resolve(jsonResponse(status))]);

        await expect(fetchRetry("https://example.com")).rejects.toThrow(`HTTP ${status}`);

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test.each([429, 500, 502, 503])("ретраит %i до успеха", async (status) => {
        mockFetchSequence([
            () => Promise.resolve(jsonResponse(status)),
            () => Promise.resolve(jsonResponse(200)),
        ]);

        const response = await fetchRetry("https://example.com");

        expect(response.status).toBe(200);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test("ретраит сетевой сбой и возвращает ответ после восстановления", async () => {
        mockFetchSequence([
            () => Promise.reject(new Error("сетевой сбой")),
            () => Promise.resolve(jsonResponse(200)),
        ]);

        const response = await fetchRetry("https://example.com");

        expect(response.status).toBe(200);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test("исчерпывает попытки при постоянной сетевой ошибке", async () => {
        mockFetchSequence([() => Promise.reject(new Error("сетевой сбой"))]);

        await expect(fetchRetry("https://example.com")).rejects.toThrow("сетевой сбой");

        expect(global.fetch).toHaveBeenCalledTimes(RETRY_MAX_ATTEMPTS);
    });

    test("исчерпывает попытки при постоянном 500", async () => {
        mockFetchSequence([() => Promise.resolve(jsonResponse(500))]);

        await expect(fetchRetry("https://example.com")).rejects.toThrow("HTTP 500");

        expect(global.fetch).toHaveBeenCalledTimes(RETRY_MAX_ATTEMPTS);
    });

    test("делает растущие задержки между попытками", async () => {
        const delays: number[] = [];
        runWithImmediateTimers(delays);
        mockFetchSequence([
            () => Promise.resolve(jsonResponse(500)),
            () => Promise.resolve(jsonResponse(500)),
            () => Promise.resolve(jsonResponse(200)),
        ]);

        await fetchRetry("https://example.com");

        expect(delays).toEqual([750, 1500]);
    });

    test("количество попыток настраивается", async () => {
        mockFetchSequence([() => Promise.resolve(jsonResponse(500))]);

        await expect(fetchRetry("https://example.com", undefined, {maxAttempts: 2})).rejects.toThrow("HTTP 500");

        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});
