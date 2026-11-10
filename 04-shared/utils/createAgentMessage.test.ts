import {test, expect, describe} from "bun:test";
import createAgentMessage from "./createAgentMessage";
import {Agent} from "../../02-handlers/dto";

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

describe("createAgentMessage — строгий стиль", () => {
    test("карточка без рассылочного контекста начинается с заголовка карточки и номера", () => {
        const agent = makeAgent();

        const message = createAgentMessage({agent, person: []});

        expect(message.startsWith("<b>Карточка агента</b> · №<code>0042</code>")).toBe(true);
    });

    test("номер дополняется нулями до четырёх знаков", () => {
        const agent = makeAgent({field_number: 7});

        const message = createAgentMessage({agent, person: []});

        expect(message).toContain("№<code>0007</code>");
    });

    test("после шапки идёт разделитель, без ведущих пустых строк и отступов", () => {
        const agent = makeAgent();

        const message = createAgentMessage({agent, person: []});

        expect(message.split("\n")[1]).toMatch(/^─+$/);
        expect(message).not.toMatch(/^\s/);
        expect(message).not.toMatch(/\n\s+\S/);
    });

    test("в рассылке новый агент — «Найденная информация», изменение — «Изменение списка»", () => {
        const agent = makeAgent();

        const newAgentMessage = createAgentMessage({agent, index: 0, agentsList: [agent], person: []});
        const changeMessage = createAgentMessage({agent, index: 2, agentsList: [agent, agent, agent], person: []});

        expect(newAgentMessage).toContain("<b>Найденная информация</b> · №<code>0042</code>");
        expect(changeMessage).toContain("<b>Изменение списка</b> (3/3) · №<code>0042</code>");
    });

    test("короткий формат всегда с нейтральной шапкой", () => {
        const agent = makeAgent();

        const message = createAgentMessage({agent, index: 3, agentsList: [agent], isShort: true, person: []});

        expect(message.startsWith("<b>Карточка агента</b> · №<code>0042</code>")).toBe(true);
        expect(message).not.toContain("Изменение списка");
    });
});

describe("createAgentMessage — полный формат", () => {
    test("содержит основные поля агента", () => {
        const agent = makeAgent();

        const message = createAgentMessage({agent, index: 0, agentsList: [agent], person: []});

        expect(message).toContain("<b>ФИО:</b> Иванов Иван Иванович");
        expect(message).toContain("<b>Основание:</b> Основание");
        expect(message).toContain("<b>Добавлен:</b> 01.01.2020");
        expect(message).toContain("<b>Тип:</b> Физические лица");
    });

    test("ссылки преобразуются в HTML-ссылки с доменом как текстом", () => {
        const agent = makeAgent({
            domain_name: "https://a.com; https://b.com",
        });

        const message = createAgentMessage({agent, index: 0, person: []});

        expect(message).toContain('<a href="https://a.com">a.com</a>');
        expect(message).toContain('<a href="https://b.com">b.com</a>');
    });

    test("ссылки идут ниже описания и каждая с новой строки", () => {
        const agent = makeAgent({
            domain_name: "https://a.com; https://b.com",
            description: "Тестовое описание",
        });

        const message = createAgentMessage({agent, index: 0, person: []});
        const lines = message.split("\n");

        expect(message.indexOf("<b>Описание:</b>")).toBeLessThan(message.indexOf("<b>Ссылки:</b>"));
        expect(lines).toContain('<a href="https://a.com">a.com</a>');
        expect(lines).toContain('<a href="https://b.com">b.com</a>');
    });

    test("в коротком формате ссылки тоже ниже описания", () => {
        const agent = makeAgent({domain_name: "https://a.com", description: "Описание"});

        const message = createAgentMessage({agent, index: 0, isShort: true, person: []});

        expect(message.indexOf("<b>Описание:</b>")).toBeLessThan(message.indexOf("<b>Ссылки:</b>"));
    });

    test("ссылка с нестандартным текстом не роняет форматирование", () => {
        const agent = makeAgent({
            domain_name: "не-ссылка",
        });

        const message = createAgentMessage({agent, index: 0, person: []});

        expect(message).toContain('<a href="не-ссылка">не-ссылка</a>');
    });

    test("отсутствие ссылок выводит прочерк", () => {
        const agent = makeAgent({domain_name: ""});

        const message = createAgentMessage({agent, index: 0, person: []});

        expect(message).toContain("<b>Ссылки:</b> —");
    });

    test("отсутствие даты удаления выводит прочерк", () => {
        const agent = makeAgent({exclusion_date: null});

        const message = createAgentMessage({agent, index: 0, person: []});

        expect(message).toContain("<b>Удалён:</b> —");
    });

    test("дата удаления выводится при наличии", () => {
        const agent = makeAgent({exclusion_date: "31.12.2025"});

        const message = createAgentMessage({agent, index: 0, person: []});

        expect(message).toContain("<b>Удалён:</b> 31.12.2025");
    });

    test("описание выводится при наличии", () => {
        const agent = makeAgent({description: "Тестовое описание"});

        const message = createAgentMessage({agent, index: 0, person: []});

        expect(message).toContain("<b>Описание:</b> Тестовое описание");
    });

    test("описание-прочерк при отсутствии", () => {
        const agent = makeAgent({description: ""});

        const message = createAgentMessage({agent, index: 0, person: []});

        expect(message).toContain("<b>Описание:</b> —");
    });
});

describe("createAgentMessage — кинопоиск", () => {
    test("ссылка на кинопоиск при kinopoisk_id", () => {
        const agent = makeAgent({kinopoisk_id: 12345});

        const message = createAgentMessage({agent, index: 0, person: []});

        expect(message).toContain('<b>Кинопоиск:</b>\n<a href="https://www.kinopoisk.ru/name/12345">профиль Кинопоиска</a>');
    });

    test("каждая ссылка-кандидат начинается с новой строки", () => {
        const agent = makeAgent({kinopoisk_id: null});
        const person = [
            {id: 111, name: "Иванов И."},
            {id: 222, name: "Иван Иванов"},
        ];

        const message = createAgentMessage({agent, index: 0, person});

        expect(message.split("\n")).toContain('<a href="https://www.kinopoisk.ru/name/111">Иванов И.</a>');
        expect(message.split("\n")).toContain('<a href="https://www.kinopoisk.ru/name/222">Иван Иванов</a>');
    });

    test("совпадения из person выводятся ссылками", () => {
        const agent = makeAgent({kinopoisk_id: null});
        const person = [
            {id: 111, name: "Иванов И."},
            {id: 222, name: "Иван Иванов"},
        ];

        const message = createAgentMessage({agent, index: 0, person});

        expect(message).toContain('<a href="https://www.kinopoisk.ru/name/111">Иванов И.</a>');
        expect(message).toContain('<a href="https://www.kinopoisk.ru/name/222">Иван Иванов</a>');
    });

    test("используется enName при отсутствии name", () => {
        const agent = makeAgent({kinopoisk_id: null});
        const person = [{id: 333, enName: "Ivanov I."}];

        const message = createAgentMessage({agent, index: 0, person});

        expect(message).toContain('<a href="https://www.kinopoisk.ru/name/333">Ivanov I.</a>');
    });

    test("нет совпадений — сообщение об отсутствии", () => {
        const agent = makeAgent({kinopoisk_id: null});

        const message = createAgentMessage({agent, index: 0, person: []});

        expect(message).toContain("Не найдено совпадений по дню рождения");
    });

    test("person равный '-' — сообщение об отсутствии", () => {
        const agent = makeAgent({kinopoisk_id: null});

        const message = createAgentMessage({agent, index: 0, person: "-"});

        expect(message).toContain("Не найдено совпадений по дню рождения");
    });

    test("kinopoisk_id имеет приоритет над person", () => {
        const agent = makeAgent({kinopoisk_id: 999});
        const person = [{id: 111, name: "Другой"}];

        const message = createAgentMessage({agent, index: 0, person});

        expect(message).toContain("https://www.kinopoisk.ru/name/999");
        expect(message).not.toContain("Другой");
    });
});

describe("createAgentMessage — короткий формат", () => {
    test("содержит только краткие поля", () => {
        const agent = makeAgent({description: "Описание"});

        const message = createAgentMessage({agent, index: 0, isShort: true, person: []});

        expect(message).toContain("<b>ФИО:</b> Иванов Иван Иванович");
        expect(message).toContain("<b>Описание:</b> Описание");
        expect(message).not.toContain("<b>Основание:</b>");
        expect(message).not.toContain("<b>Добавлен:</b>");
        expect(message).not.toContain("<b>Тип:</b>");
    });

    test("ссылки работают в коротком формате", () => {
        const agent = makeAgent({domain_name: "https://a.com"});

        const message = createAgentMessage({agent, index: 0, isShort: true, person: []});

        expect(message).toContain('<a href="https://a.com">a.com</a>');
    });
});

describe("createAgentMessage — дата рождения", () => {
    test("в полной карточке сырого агента реестра дата рождения идёт сразу после ФИО", () => {
        const agent = {
            field_1_i: 42,
            field_2_s: "Иванов Иван Иванович",
            field_3_s: "Основание",
            field_4_s: "01.01.2020",
            field_5_s: "",
            field_6_s: "https://example.com",
            field_7_s: "Физические лица",
            field_12_s: "01.01.1980",
        };

        const message = createAgentMessage({agent, index: 0, person: []});
        const lines = message.split("\n");

        expect(message).toContain("<b>Дата рождения:</b> 01.01.1980");
        expect(lines[lines.indexOf("<b>ФИО:</b> Иванов Иван Иванович") + 1]).toBe("<b>Дата рождения:</b> 01.01.1980");
    });

    test("в полной карточке агента из БД дата рождения выводится после переименования полей", () => {
        const agent = makeAgent({birthday: "01.01.1980"});

        const message = createAgentMessage({agent, index: 0, person: []});
        const lines = message.split("\n");

        expect(message).toContain("<b>Дата рождения:</b> 01.01.1980");
        expect(lines[lines.indexOf("<b>ФИО:</b> Иванов Иван Иванович") + 1]).toBe("<b>Дата рождения:</b> 01.01.1980");
    });

    test("даты нет ни в birthday, ни в field_12_s — выводится прочерк", () => {
        const dbAgent = makeAgent({birthday: null});
        const rawAgent = {
            field_1_i: 42,
            field_2_s: "Иванов Иван Иванович",
            field_3_s: "Основание",
            field_4_s: "01.01.2020",
            field_5_s: "",
            field_6_s: "https://example.com",
            field_7_s: "Физические лица",
        };

        const dbMessage = createAgentMessage({agent: dbAgent, index: 0, person: []});
        const rawMessage = createAgentMessage({agent: rawAgent, index: 0, person: []});

        expect(dbMessage).toContain("<b>Дата рождения:</b> —");
        expect(rawMessage).toContain("<b>Дата рождения:</b> —");
    });

    test("в короткой карточке дата рождения тоже идёт под ФИО", () => {
        const agent = makeAgent({birthday: "01.01.1980"});

        const message = createAgentMessage({agent, index: 0, isShort: true, person: []});
        const lines = message.split("\n");

        expect(message).toContain("<b>Дата рождения:</b> 01.01.1980");
        expect(lines[lines.indexOf("<b>ФИО:</b> Иванов Иван Иванович") + 1]).toBe("<b>Дата рождения:</b> 01.01.1980");
    });
});

describe("createAgentMessage — маппинг полей", () => {
    test("поля БД переименовываются в поля реестра", () => {
        const agent = makeAgent({name: "Тестовое Имя"});

        const message = createAgentMessage({agent, index: 0, person: []});

        expect(message).toContain("<b>ФИО:</b> Тестовое Имя");
    });

    test("agent без name не падает", () => {
        const agent = makeAgent();
        delete (agent as Partial<Agent>).name;

        const message = createAgentMessage({agent, index: 0, person: []});

        expect(typeof message).toBe("string");
    });
});
