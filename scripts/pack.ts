import {packCards} from "../04-shared/utils/archive";

const archive = await packCards();
console.log(`Карточки упакованы: ${archive}`);
