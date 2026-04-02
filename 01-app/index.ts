import AgentsManager from "./manager";
import {FabricLogger, ILogger} from "../04-shared/utils/logger";

const logger: ILogger = FabricLogger.createLogger()
const processingError = async (callback: any) => {
    try {
        await callback()
    } catch (err) {
        logger.error(err);
        process.exit(1);
    }
}

const manager = new AgentsManager();

(async () => {
    await processingError(manager.startService.bind(manager))
})()

process.once('SIGINT', () => {
    manager.stop('SIGINT')
    logger.info('Пользователь завершил работу бота');
    process.exit(0)
})
process.once('SIGTERM', () => {
    manager.stop('SIGTERM')
    logger.info('Система завершила работу бота');
    process.exit(0)
})