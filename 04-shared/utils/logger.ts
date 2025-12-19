import pino from "pino";

const logPath = Bun.fileURLToPath(new URL('../../logs/app.log', import.meta.url));
const transport = pino.transport({
    target: 'pino/file',
    options: {destination: logPath}
});

const logger = Bun.env.IS_DEV
    ? pino()
    : pino({
        level: 'info'
    }, transport);
export default logger