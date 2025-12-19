import sharp from 'sharp';

export default async (ctx, name, path = '../../uploads/') => {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const id = photo.file_id
    const file = await ctx.telegram.getFile(id);
    const fileUrl = `https://api.telegram.org/file/bot${Bun.env.BOT_TOKEN}/${file.file_path}`;

    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    const webpBuffer = await sharp(buffer)
        .resize({ height: 700 })
        .webp({ quality: 80 })
        .toBuffer()

    const fileName = name ? `${name}.webp` : `${file.file_unique_id}.webp`;
    const uploadsDir = Bun.fileURLToPath(new URL(path, import.meta.url));
    const fullPath = `${uploadsDir}${fileName}`;

    await Bun.write(fullPath, webpBuffer)
    return fileName
}