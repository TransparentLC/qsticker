import { xxh3 } from '@node-rs/xxhash';
import { etag as honoEtag } from 'hono/etag';
import { createMiddleware } from 'hono/factory';
import { validator as zValidator } from 'hono-openapi';
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
        ctx.env?.incoming.socket.remoteAddress;
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

export const etag: typeof honoEtag = (options = {}) =>
    honoEtag({
        generateDigest: body => {
            const h = xxh3.xxh128(body, 0x0d00072100114514n);
            const r = new Uint8Array(16);
            const dv = new DataView(r.buffer);
            dv.setBigUint64(8, h);
            dv.setBigUint64(0, h >> 64n);
            return r.buffer;
        },
        ...options,
    });
