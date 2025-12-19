import {Context} from "telegraf";

export default async (ctx: Context): Promise<void> => {
    ctx.reply(`Есть команды: 
/help, 
/online - проверяет доступен ли бот, 
/search (agents) - поиск по фамилии агента, 
/edit_description (agents) (description) - добавление описания агенту, работает по фамилии, 
/edit_photo (agents) - добавление фото агенту. Без фото не работает и так же по фамилии`)
}