import { xxh3 } from '@node-rs/xxhash';
import { etag as honoEtag } from 'hono/etag';
import { createMiddleware } from 'hono/factory';
import { validator as zValidator } from 'hono-openapi';
import { fromError } from 'zod-validation-error';
import createLogger from './logger';

const httpLogger = createLogger('http');

export const logger = createMiddleware(async (ctx, next) => {
    const startTime = performance.now();

    await next();

    httpLogger.info(
        {
            http: {
                remoteAddress:
                    ctx.req.header('X-Real-IP') ??
                    ctx.req
                        .header('X-Forwarded-For')
                        ?.split(',')
                        .pop()
                        ?.trim() ??
                    ctx.env.incoming.socket.remoteAddress,
                remotePort: ctx.env.incoming.socket.remotePort,
                method: ctx.req.method,
                path: ctx.req.path,
                status: ctx.res.status,
                time: performance.now() - startTime,
            },
        },
        '',
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
                        {
                            // https://github.com/causaly/zod-validation-error/blob/main/lib/v4/isZodErrorLike.ts
                            error: fromError({
                                name: 'ZodError',
                                issues: result.error,
                            }).toString(),
                        },
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

export const etagIfEmpty: typeof honoEtag = (options = {}) => {
    const etagMiddleware = etag(options);
    return async (ctx, next) => {
        await next();
        if (!ctx.res.headers.has('etag'))
            await etagMiddleware(ctx, async () => {});
    };
};
