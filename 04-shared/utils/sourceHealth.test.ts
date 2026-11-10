import {test, expect, describe, mock, afterEach, setSystemTime} from "bun:test";
import {SourceHealthTracker} from "./sourceHealth";

const makeTracker = (
    notify: ReturnType<typeof mock>,
    overrides: Partial<ConstructorParameters<typeof SourceHealthTracker>[0]> = {}
) => new SourceHealthTracker({name: "Минюст", notify, ...overrides});

const setTime = (iso: string) => setSystemTime(new Date(iso));

afterEach(() => {
    setSystemTime();
});

describe("SourceHealthTracker", () => {
    test("до порога подряд неуспешных прогонов алерт не отправляется", async () => {
        const notify = mock();
        const tracker = makeTracker(notify);

        await tracker.failure();
        await tracker.failure();

        expect(notify).not.toHaveBeenCalled();
    });

    test("на пороге отправляет алерт с числом минут простоя", async () => {
        const notify = mock();
        const tracker = makeTracker(notify);

        setTime("2026-09-21T12:00:00");
        await tracker.failure();
        setTime("2026-09-21T12:30:00");
        await tracker.failure();
        setTime("2026-09-21T13:00:00");
        await tracker.failure();

        expect(notify).toHaveBeenCalledTimes(1);
        expect(notify).toHaveBeenCalledWith("Минюст недоступен уже 60 минут");
    });

    test("повторный алерт не чаще раза в час", async () => {
        const notify = mock();
        const tracker = makeTracker(notify);

        setTime("2026-09-21T12:00:00");
        await tracker.failure();
        setTime("2026-09-21T12:30:00");
        await tracker.failure();
        setTime("2026-09-21T13:00:00");
        await tracker.failure();
        setTime("2026-09-21T13:10:00");
        await tracker.failure();
        setTime("2026-09-21T14:10:00");
        await tracker.failure();

        expect(notify).toHaveBeenCalledTimes(2);
        expect(notify).toHaveBeenNthCalledWith(2, "Минюст недоступен уже 130 минут");
    });

    test("после восстановления сообщает «снова доступен» и сбрасывает состояние", async () => {
        const notify = mock();
        const tracker = makeTracker(notify);

        setTime("2026-09-21T12:00:00");
        await tracker.failure();
        setTime("2026-09-21T12:30:00");
        await tracker.failure();
        setTime("2026-09-21T13:00:00");
        await tracker.failure();

        setTime("2026-09-21T13:30:00");
        await tracker.success();

        expect(notify).toHaveBeenCalledTimes(2);
        expect(notify).toHaveBeenNthCalledWith(2, "Минюст снова доступен");

        setTime("2026-09-21T14:00:00");
        await tracker.success();
        expect(notify).toHaveBeenCalledTimes(2);

        setTime("2026-09-21T14:30:00");
        await tracker.failure();
        setTime("2026-09-21T15:00:00");
        await tracker.failure();
        setTime("2026-09-21T15:30:00");
        await tracker.failure();

        expect(notify).toHaveBeenCalledTimes(3);
        expect(notify).toHaveBeenNthCalledWith(3, "Минюст недоступен уже 60 минут");
    });

    test("восстановление до порога проходит молча и сбрасывает счётчик", async () => {
        const notify = mock();
        const tracker = makeTracker(notify);

        await tracker.failure();
        await tracker.failure();
        await tracker.success();
        await tracker.failure();
        await tracker.failure();

        expect(notify).not.toHaveBeenCalled();
    });

    test("успех без сбоев ничего не отправляет", async () => {
        const notify = mock();
        const tracker = makeTracker(notify);

        await tracker.success();

        expect(notify).not.toHaveBeenCalled();
    });

    test("порог настраивается", async () => {
        const notify = mock();
        const tracker = makeTracker(notify, {threshold: 1});

        setTime("2026-09-21T12:00:00");
        await tracker.failure();

        expect(notify).toHaveBeenCalledTimes(1);
        expect(notify).toHaveBeenCalledWith("Минюст недоступен уже 0 минут");
    });

    test("имя источника подставляется в тексты", async () => {
        const notify = mock();
        const tracker = new SourceHealthTracker({name: "Кинопоиск", notify, threshold: 1});

        await tracker.failure();
        await tracker.success();

        expect(notify).toHaveBeenNthCalledWith(1, "Кинопоиск недоступен уже 0 минут");
        expect(notify).toHaveBeenNthCalledWith(2, "Кинопоиск снова доступен");
    });
});
