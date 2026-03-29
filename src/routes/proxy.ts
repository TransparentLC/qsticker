import { Hono, type HonoRequest } from 'hono';
import { proxy as honoProxy } from 'hono/proxy';
import type { BlankEnv, BlankSchema, Env, Schema } from 'hono/types';
import type { StatusCode } from 'hono/utils/http-status';
import { etagIfEmpty } from '../middlewares';

const headersWhitelist = new Set([
    'content-length',
    'content-type',
    'date',
    'etag',
    'expires',
    'last-modified',
    'vary',
]);

const routeProxy = <
    E extends Env = BlankEnv,
    S extends Schema = BlankSchema,
    BasePath extends string = '/',
    P extends string = string,
>(
    app: Hono<E, S, BasePath>,
    path: P,
    originRule: (param: HonoRequest<P>['param']) => string,
) => {
    app.get(path, async ctx => {
        const origin = originRule(ctx.req.param.bind(ctx.req));
        const r = await honoProxy(origin);
        if (r.status === 200) {
            Array.from(r.headers.keys())
                .filter(e => !headersWhitelist.has(e.toLowerCase()))
                .forEach(e => {
                    r.headers.delete(e);
                });
            r.headers.set('Cache-Control', 'public, immutable, max-age=604800');
            return r;
        }
        if (r.status === 404) return ctx.notFound();
        return ctx.body(null, r.status >= 400 ? (r.status as StatusCode) : 500);
    });
};

const app = new Hono<HonoSchema>();
app.use(etagIfEmpty());
routeProxy(
    app,
    '/parcel/:md5{[\\da-f]{32}}/:filename{126x126\\.png|200x200\\.png|300x300\\.png|raw200\\.gif|raw300\\.gif}',
    param =>
        `https://i.gtimg.cn/club/item/parcel/item/${param('md5').substring(0, 2)}/${param('md5')}/${param('filename')}`,
);
routeProxy(
    app,
    '/parcel/:emoticonId{\\d{6}}/:filename{200x200\\.png}',
    param =>
        `https://i.gtimg.cn/club/item/parcel/img/parcel/${param('emoticonId').substring(5, 6)}/${param('emoticonId')}/${param('filename')}`,
);
routeProxy(
    app,
    '/bfs/:type{garb(/item)?|emote}/:filename{[\\da-f]{40}\\.(jpg|png|gif|webp)}',
    param => `https://i0.hdslb.com/bfs/${param('type')}/${param('filename')}`,
);

export default app;
