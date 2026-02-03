import {Context} from "telegraf";
import {sql} from "bun";
import {utils, write} from "xlsx";
import path from "path";


export default async (ctx: Context): Promise<void> => {
    const info = await sql`SELECT a.*, i.description
                    FROM agents a
                    LEFT JOIN info i ON a.id = i.agent_id ORDER BY a.field_number`
    const excelSheet = info.map((el) => {
        return {
            'Номер': el.field_number,
            'Тип': el.type_agent || 'Не указан',
            'Имя': el.name,
            'Причина добавления': el.article,
            'День рождение': el.birthday || 'Не указано',
            'Дата добавления': el.adoption_date,
            'Дата удаления': el.exclusion_date || 'Не удален/a',
            'Ссылки на ресурсы': el.domain_name || 'Отсутствуют',
            'Кинопоиск': el.kinopoisk_id ? `https://www.kinopoisk.ru/name//${el.kinopoisk_id}/` : 'Не добавлен',
            'Описание': el.description || 'Не добавлено'
        }
    })
    const ws = utils.json_to_sheet(excelSheet);
    ws['!cols'] = [
        { wch: 9 },
        { wch: 20 },
        { wch: 50 },
        { wch: 40 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 40 },
        { wch: 40 },
        { wch: 40 },
    ];
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "agentsStats");
    const fullPath = path.join(process.cwd(), 'uploads', "agents.xlsx");
    const excelBuffer = write(wb, {
        bookType: 'xlsx',
        type: 'array',
        compression: true
    });
    await Bun.write(fullPath, excelBuffer);
    await ctx.replyWithDocument({
        source: fullPath,
        filename: 'agents.xlsx'
    });
}
