import getPersonList from "./getPersonList";


export default async (info) => {
    const isActual = info?.kinopoisk_info?.length > 0
        ? info?.kinopoisk_info[0].timestamp + (30 * 24 * 60 * 60 * 1000) > Date.now()
        : false
    if (info?.kinopoisk_info && isActual) {
        return info.kinopoisk_info
    }
    return await getPersonList(info.name, info.birthday, info.type_agent, info.id)
}