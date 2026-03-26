import fs from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Scalar } from '@scalar/hono-api-reference';
import { Hono } from 'hono';
import type { HTTPResponseError } from 'hono/types';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { openAPIRouteHandler } from 'hono-openapi';
import config from './config';
import createLogger from './logger';
import { etag, logger } from './middlewares';
import routes from './routes';

if (!fs.existsSync('storage')) fs.mkdirSync('storage');

const app = new Hono<HonoSchema>().basePath(config.server.base);
const appLogger = createLogger('app');

app.use(logger)
    .onError((err, ctx) => {
        let statusCode = (err as HTTPResponseError).getResponse?.()
            .status as ContentfulStatusCode;
        if (!statusCode) {
            statusCode = 500;
            console.error(err);
        }
        return ctx.json({ error: err.message }, statusCode);
    })
    .route('/', routes)
    .use(
        '/storage/*',
        etag(),
        serveStatic({
            root: './storage',
            rewriteRequestPath: p =>
                p
                    .substring(config.server.base.length - 1)
                    .replace(/^\/storage/, ''),
            onFound: (_, ctx) => {
                ctx.header(
                    'Cache-Control',
                    'public, immutable, max-age=604800',
                );
            },
        }),
    )
    .get(
        '/openapi.json',
        openAPIRouteHandler(app, {
            documentation: {
                info: {
                    title: 'Qsticker Archive',
                    version: '2.0.0',
                    description:
                        '只有爬取表情包的相关 API 才需要管理员 Token。',
                },
                components: {
                    securitySchemes: {
                        adminToken: {
                            type: 'http',
                            scheme: 'bearer',
                        },
                    },
                },
                security: [{ adminToken: [] }],
            },
        }),
    )
    .get('/docs', Scalar({ url: 'openapi.json', withDefaultFonts: false }))
    .use(serveStatic({ root: './public' }));

if (
    typeof config.server.port === 'string' &&
    fs.existsSync(config.server.port)
) {
    fs.unlinkSync(config.server.port);
}

serve({
    fetch: (req, env) => {
        const url = new URL(req.url);
        url.protocol = req.headers.get('x-forwarded-proto') ?? url.protocol;
        return app.fetch(new Request(url, req), env);
    },
    hostname: config.server.host,
    port: config.server.port,
});

if (typeof config.server.port === 'string') {
    fs.chmodSync(config.server.port, 666);
}

appLogger.info(
    'Server is running on %s:%s',
    config.server.host,
    config.server.port,
);
