import { createMiddleware } from 'hono/factory';
import { validator as zValidator } from 'hono-openapi';
import { rateLimiter as honoRateLimiter } from 'hono-rate-limiter';
import { fromError } from 'zod-validation-error';

export const logger = createMiddleware(async (ctx, next) => {
    const startTime = performance.now();

    await next();

    const statusCode = ctx.res.status;
    const statusString = process.env.NO_COLOR
        ? statusCode.toString()
        : `\x1b[${[39, 94, 92, 96, 93, 91, 95][(statusCode / 100) | 0]}m${statusCode}\x1b[0m`;
    const remoteAddress =
        ctx.req.header('X-Real-IP') ??
        ctx.req.header('X-Forwarded-For')?.split(',').pop()?.trim() ??
        ctx.env.incoming.socket.remoteAddress;
    console.log(
        new Date().toISOString(),
        '-',
        remoteAddress,
        ctx.req.method,
        ctx.req.path,
        statusString,
        `${(performance.now() - startTime).toFixed(2)}ms`,
    );
});

export const validator: typeof zValidator = (target, schema, hook) =>
    // @ts-expect-error
    zValidator(
        target,
        schema,
        hook ||
            ((result, ctx) => {
                if (!result.success)
                    return ctx.json(
                        { error: fromError(result.error).toString() },
                        400,
                    );
            }),
    );

export const rateLimiter: typeof honoRateLimiter = config =>
    honoRateLimiter({
        standardHeaders: 'draft-7',
        message: { error: 'Too many requests, please try again later.' },
        ...config,
    });
