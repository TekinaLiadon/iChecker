import {unpackCards} from "../04-shared/utils/archive";

const archivePath = Bun.argv[2];
if (!archivePath) {
    console.error("Укажи путь к архиву: bun run unpack backups/ichecker-cards-ГГГГММДД-ЧЧММсс.tar.gz");
    process.exit(1);
}

await unpackCards(archivePath);
console.log(`Карточки распакованы в uploads из ${archivePath}`);
