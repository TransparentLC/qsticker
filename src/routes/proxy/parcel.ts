import { Hono } from 'hono';
import { proxy } from 'hono/proxy';
import type { StatusCode } from 'hono/utils/http-status';
import { etag } from '../../middlewares';

const app = new Hono<HonoSchema>();

// https://i.gtimg.cn/club/item/parcel/item/04/049bc8886bd37a22f353f3d94ab4ec61/raw300.gif
// -> /proxy/parcel/049bc8886bd37a22f353f3d94ab4ec61/raw300.gif
// https://i.gtimg.cn/club/item/parcel/img/parcel/8/245268/200x200.png
// -> /proxy/parcel/245268/200x200.png
app.get(
    '/:md5{[\\da-f]{32}|\\d{6}}/:filename{126x126\\.png|200x200\\.png|300x300\\.png|raw200\\.gif|raw300\\.gif}',
    etag(),
    async ctx => {
        const r = await proxy(
            ctx.req.param('md5').length === 32
                ? `https://i.gtimg.cn/club/item/parcel/item/${ctx.req.param('md5').substring(0, 2)}/${ctx.req.param('md5')}/${ctx.req.param('filename')}`
                : `https://i.gtimg.cn/club/item/parcel/img/parcel/${ctx.req.param('md5').substring(5, 6)}/${ctx.req.param('md5')}/${ctx.req.param('filename')}`,
        );
        if (r.status === 200) {
            r.headers.set('Cache-Control', 'public, immutable, max-age=604800');
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
        return ctx.body(null, r.status >= 400 ? (r.status as StatusCode) : 500);
    },
);

export default app;
