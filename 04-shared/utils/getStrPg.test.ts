import {test, expect} from "bun:test";
import getStrPg from "./getStrPg";
import {AgentInfo} from "../../02-handlers/dto";

const makeAgent = (overrides: Partial<AgentInfo> = {}): AgentInfo => ({
    field_1_i: 42,
    field_2_s: "Иванов Иван Иванович",
    field_3_s: "Основание",
    field_4_s: "01.01.2020",
    field_5_s: "31.12.2025",
    field_6_s: "https://example.com",
    field_7_s: "Физические лица",
    field_12_s: "01.01.1980",
    lastModified_l: 1600000000,
    ...overrides,
});

test("getStrPg: формирует values для одного агента", () => {
    const result = getStrPg([makeAgent()]);

    expect(result).toBe(`(
    '42',
    'Иванов Иван Иванович',
    'Основание',
    '01.01.2020',
    '31.12.2025',
    'https://example.com',
    'Физические лица',
    '1600000000',
    '01.01.1980'
  )`);
});

test("getStrPg: экранирует одинарные кавычки", () => {
    const result = getStrPg([makeAgent({field_3_s: "O'Brien и 'кавычки'"})]);

    expect(result).toContain(`'O''Brien и ''кавычки'''`);
});

test("getStrPg: не-строковые значения не экранируются", () => {
    const result = getStrPg([makeAgent({field_1_i: 7, lastModified_l: 123})]);

    expect(result).toContain(`'7'`);
    expect(result).toContain(`'123'`);
});

test("getStrPg: несколько агентов объединяются через запятую", () => {
    const result = getStrPg([makeAgent({field_1_i: 1}), makeAgent({field_1_i: 2})]);

    expect(result.match(/\),\(/gu)).toHaveLength(1);
    expect(result).toContain(`'1'`);
    expect(result).toContain(`'2'`);
});

test("getStrPg: пустой список возвращает пустую строку", () => {
    expect(getStrPg([])).toBe("");
});

test("getStrPg: null-поля попадают в вывод как null", () => {
    const result = getStrPg([makeAgent({field_5_s: null as unknown as string})]);

    expect(result).toContain(`'null'`);
});
