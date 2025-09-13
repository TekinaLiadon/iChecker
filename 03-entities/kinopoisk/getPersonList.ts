import {Query} from "./type";

var wordsListExceptions = ["проект", "сетевой", "интернет-портал", "общественное", "движение",
    "медиапроект", "международная", "организация", "издание", "общество", "центр", "исследовательский",
    "антивоенное", "этническое", "интернет-издание", "благотворительный", "фонд", "некоммерческое",
    "партнерство",]
var nameCheck = (str: string): string => {
    const [firstName, lastName] = str.trim().split(/\s+/)
    if(!/^[А-ЯЁA-Z]/.test(firstName) || !/^[А-ЯЁA-Z]/.test(lastName)) return '-'
    if(wordsListExceptions.includes(firstName.toLowerCase()) || wordsListExceptions.includes(lastName.toLowerCase())) return '-'

    return `${firstName} ${lastName}`
}
export default async (query: string) => {
    const name = nameCheck(query)
    if(name === '-') return name
    var data: Query = {
        page: 1,
        limit: 3,
        query: name,
    };
    var url: string = `https://api.kinopoisk.dev/v1.4/person/search?${new URLSearchParams(data).toString()}`
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json", "X-API-KEY": Bun.env.KINOPOISK_TOKEN },
    });
    const result = await response.json();
    return result.docs
}