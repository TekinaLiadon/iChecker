import {Query} from "./type";
import {sql} from "bun";

var wordsListExceptions = ["проект", "сетевой", "интернет-портал", "общественное", "движение",
    "медиапроект", "международная", "организация", "издание", "общество", "центр", "исследовательский",
    "антивоенное", "этническое", "интернет-издание", "благотворительный", "фонд", "некоммерческое",
    "партнерство",]
var nameCheck = (str: string): string => {
    const [firstName, lastName] = str.trim().split(/\s+/)
    if(!/^[А-ЯЁA-Z]/.test(firstName) || !/^[А-ЯЁA-Z]/.test(lastName)) return '-'
    if(wordsListExceptions.includes(firstName.toLowerCase()) || wordsListExceptions.includes(lastName.toLowerCase())) return '-'
    return `${lastName} ${firstName}`
}
function areDatesEqual(date1, date2) {
    const normalizeDate = (date) => {
        let d;
        if (typeof date === 'string') {
            if (date.includes('T') && date.includes('Z')) {
                d = new Date(date);
            } else {
                const parts = date.split('.');
                if (parts.length === 3) {
                    d = new Date(Date.UTC(parts[2], parts[1] - 1, parts[0]));
                } else {
                    d = new Date(date);
                }
            }
        } else if (date instanceof Date) {
            d = date;
        } else {
            return null;
        }

        if (isNaN(d.getTime())) {
            return null;
        }

        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    };

    const normalizedDate1 = normalizeDate(date1);
    const normalizedDate2 = normalizeDate(date2);

    if (normalizedDate1 === null || normalizedDate2 === null) {
        return false;
    }

    return normalizedDate1.getTime() === normalizedDate2.getTime();
}
export default async (query: string, birthday:string, id: number) => {
    const name = nameCheck(query)
    if(name === '-') return name
    var data: Query = {
        page: 1,
        limit: 5,
        query: name,
    };
    var url: string = `https://api.kinopoisk.dev/v1.4/person/search?${new URLSearchParams(data).toString()}`
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json", "X-API-KEY": Bun.env.KINOPOISK_TOKEN },
    });
    let {docs: result} = await response.json();
    result = result.filter((el) => {
        return areDatesEqual(el.birthday, birthday)
    })
    const dataSave = result.map((el) => {
        el.timestamp = Date.now()
        return el
    })
    await sql`UPDATE agents SET kinopoisk_info = ${dataSave}::jsonb WHERE id = ${id};`
    if (result.length === 0) return []
    return result
}