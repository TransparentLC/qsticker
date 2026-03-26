import pino from 'pino';

const logger = pino();

export default (module: string, options?: pino.ChildLoggerOptions) =>
    logger.child({ module }, options);
