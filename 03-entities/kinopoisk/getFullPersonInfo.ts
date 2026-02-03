import getPersonIdInfo from "./getPersonIdInfo";


export default async (info, isFast) => {
    if(isFast) return await getPersonIdInfo(info?.kinopoisk_info[0]?.id)
    const isActual = info?.kinopoisk_full?.length > 0
        ? info?.kinopoisk_full.timestamp + (30 * 24 * 60 * 60 * 1000) > Date.now()
        : false
    if (info?.kinopoisk_full && isActual) {
        return info.kinopoisk_full
    }
    return await getPersonIdInfo(info?.kinopoisk_id, info.id)
}