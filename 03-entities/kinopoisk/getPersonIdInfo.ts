import {sql} from "bun";


export default async (id, personId)=> {
    var url: string = `https://api.kinopoisk.dev/v1.4/person/${id}`
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json", "X-API-KEY": Bun.env.KINOPOISK_TOKEN },
    });
    let result = await response.json();
    if(personId) {
        result.timestamp = Date.now()
        await sql`UPDATE agents SET kinopoisk_full = ${result}::jsonb WHERE id = ${personId};`
    }
    if (!result) return {}
    return result
}