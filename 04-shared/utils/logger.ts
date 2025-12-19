import pino from "pino";
import * as path from "path";

const logPath = path.join(process.cwd(), 'logs', 'app.log');
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