import {test, expect, describe} from "bun:test";
import path from "path";

const clientPath = path.join(import.meta.dir, "../node_modules/telegraf/lib/core/network/client.js");
const clientSource = await Bun.file(clientPath).text();
const redactSource = clientSource.match(/function redactToken\(error\) \{[\s\S]*?\n\}/u);
const redactToken = new Function(`${redactSource?.[0]}; return redactToken;`)() as (error: Error) => never;

class FetchFailure extends Error {
    #text: string;

    constructor(text: string) {
        super();
        this.#text = text;
    }

    override get message(): string {
        return this.#text;
    }
}

describe("telegraf redactToken (патч readonly message)", () => {
    test("ошибка fetch с readonly message пробрасывается как есть, без TypeError", () => {
        const failure = new FetchFailure("connect ECONNREFUSED /bot123456:secret/getMe");
        let caught: unknown;

        try {
            redactToken(failure);
        } catch (error) {
            caught = error;
        }

        expect(caught).toBe(failure);
    });

    test("ошибка с обычным message получает скрытый токен", () => {
        const failure = new Error("connect ECONNREFUSED /bot123456:secret/getMe");

        expect(() => redactToken(failure)).toThrow();
        expect(failure.message).toBe("connect ECONNREFUSED /bot123456:[REDACTED]/getMe");
    });
});
