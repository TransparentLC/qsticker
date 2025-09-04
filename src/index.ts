import fs from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Scalar } from '@scalar/hono-api-reference';
import { Hono } from 'hono';
import { proxy } from 'hono/proxy';
import type { HTTPResponseError } from 'hono/types';
import type { ContentfulStatusCode, StatusCode } from 'hono/utils/http-status';
import { openAPIRouteHandler } from 'hono-openapi';
import config from './config';
import { etag, logger } from './middlewares';
import apiRoutes from './routes';

if (!fs.existsSync('storage')) fs.mkdirSync('storage');

const app = new Hono<HonoSchema>().basePath(config.server.base);

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
    .route('/api', apiRoutes)
    .get(
        '/parcel/:md5{[\\da-f]{32}|\\d{6}}/:filename{126x126\\.png|200x200\\.png|300x300\\.png|raw200\\.gif|raw300\\.gif}',
        etag(),
        async ctx => {
            const r = await proxy(
                ctx.req.param('md5').length === 32
                    ? `https://i.gtimg.cn/club/item/parcel/item/${ctx.req.param('md5').substring(0, 2)}/${ctx.req.param('md5')}/${ctx.req.param('filename')}`
                    : `https://i.gtimg.cn/club/item/parcel/img/parcel/${ctx.req.param('md5').substring(5, 6)}/${ctx.req.param('md5')}/${ctx.req.param('filename')}`,
            );
            if (r.status === 200) {
                r.headers.set(
                    'Cache-Control',
                    'public, immutable, max-age=604800',
                );
                [
                    'Alt-Svc',
                    'Server',
                    'Vary',
                    'X-Cache-Lookup',
                    'X-Datasrc',
                    'X-Nws-Log-Uuid',
                    'X-Reqgue',
                ].forEach(e => {
                    r.headers.delete(e);
                });
                return r;
            }
            if (r.status === 404) return ctx.notFound();
            return ctx.body(
                null,
                r.status >= 400 ? (r.status as StatusCode) : 500,
            );
        },
    )
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
                    version: '1.0.0',
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
    fetch: req => {
        const url = new URL(req.url);
        url.protocol = req.headers.get('x-forwarded-proto') ?? url.protocol;
        return app.fetch(new Request(url, req));
    },
    hostname: config.server.host,
    port: config.server.port,
});

if (typeof config.server.port === 'string') {
    fs.chmodSync(config.server.port, 666);
}

console.log(`Server is running on ${config.server.host}:${config.server.port}`);
