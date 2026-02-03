import {Context} from "telegraf";

export default async (ctx: Context): Promise<void> => {
    ctx.reply(`Есть команды: 
/help, 
/online - проверяет доступен ли бот, 
/search (agents) - поиск по фамилии агента, 
/edit_description (agents) (description) - добавление описания агенту, работает по фамилии, 
/edit_photo (agents) - добавление фото агенту. Без фото не работает и так же по фамилии,
/search_short (agents) - выводит только ФИО, Ссылки, Кинопоиск, Описание и Фото
/search_film (agents) - выводит только список фильмов
/add_link (number) (link) - добавляет ссылку на кинопоиск агенту по его номеру
/table - отдает таблицу всех агентов`)
}