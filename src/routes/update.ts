import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { eq, max } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import cron from 'node-cron';
import pLimit from 'p-limit';
import { z } from 'zod';
import config from '../config';
import db from '../database';
import { archiveEmoticon, fetchEmoticon } from '../emoticon';
import { validator } from '../middlewares';
import { emoticon } from '../schema';

const ensureAdmin: MiddlewareHandler = async (ctx, next) => {
    if (
        config.update.token &&
        ctx.req.header('Authorization') !== `Bearer ${config.update.token}`
    )
        return ctx.body(null, 403);
    await next();
};

const app = new Hono<HonoSchema>();
app.use(ensureAdmin);

type FetchEmoticonResult = {
    time: Date;
    emoticonId: number;
    result: 'fetched' | 'unchanged' | 'failed';
};

const fetchEmoticonResults: FetchEmoticonResult[] = [];
const fetchEmoticonResultsAppend = (
    result: Omit<FetchEmoticonResult, 'time'>,
) => {
    while (fetchEmoticonResults.length > 50) fetchEmoticonResults.pop();
    fetchEmoticonResults.unshift({ time: new Date(), ...result });
};

const fetchEmoticonLimit = pLimit(4);

const fetchEmoticonWithCheck = async (
    emoticonIds: number[],
    force: boolean,
) => {
    return await Promise.all(
        emoticonIds.map(emoticonId =>
            fetchEmoticonLimit(async () => {
                const metadataCheckFetched = db
                    .select({
                        emoticonId: emoticon.emoticonId,
                        name: emoticon.name,
                        archiveUrl: emoticon.archiveUrl,
                    })
                    .from(emoticon)
                    .where(eq(emoticon.emoticonId, emoticonId))
                    .get();
                if (
                    metadataCheckFetched &&
                    !force &&
                    (metadataCheckFetched.archiveUrl.match(/^https?:\/\//) ||
                        (await fs.promises
                            .access(metadataCheckFetched.archiveUrl)
                            .then(
                                () => true,
                                () => false,
                            )))
                ) {
                    return fetchEmoticonResultsAppend({
                        emoticonId,
                        result: 'unchanged',
                    });
                }
                db.delete(emoticon)
                    .where(eq(emoticon.emoticonId, emoticonId))
                    .run();
                try {
                    const metadata = await fetchEmoticon(emoticonId);
                    const archiveHash = crypto
                        .createHmac('sha256', config.update.salt)
                        .update(`${emoticonId}#${metadata.name}`)
                        .digest()
                        .toString('hex');
                    const archivePath = path.join(
                        'storage',
                        archiveHash.substring(0, 2),
                        `${archiveHash}.zip`,
                    );
                    await fs.promises.mkdir(path.dirname(archivePath), {
                        recursive: true,
                    });
                    await archiveEmoticon(metadata, archivePath);
                    metadata.archiveUrl = `${archivePath.replaceAll(path.sep, '/')}`;
                    metadata.archiveSize = (
                        await fs.promises.stat(archivePath)
                    ).size;
                    db.insert(emoticon).values(metadata).run();
                    return fetchEmoticonResultsAppend({
                        emoticonId,
                        result: 'fetched',
                    });
                } catch (e) {
                    console.log(e);
                    return fetchEmoticonResultsAppend({
                        emoticonId,
                        result: 'unchanged',
                    });
                }
            }),
        ),
    );
};

cron.schedule(config.update.cron, () => {
    // biome-ignore lint/style/noNonNullAssertion: max()必定存在
    const emoticonId = db
        .select({ emoticonId: max(emoticon.emoticonId) })
        .from(emoticon)
        .get()!.emoticonId!;
    const from = emoticonId - config.update.range;
    const to = emoticonId + config.update.range;
    console.log('Cron update emoticon from', from, 'to', to);
    fetchEmoticonWithCheck(
        Array(to - from + 1)
            .fill(0)
            .map((_, i) => i + from),
        false,
    );
});
console.log('Cron update emoticon', config.update.cron);

app.post(
    '/:emoticonId{\\d+}',
    describeRoute({
        description: '爬取一个表情包。需要管理员 Token。',
        responses: {
            200: {
                description: '',
                content: {
                    'application/json': {
                        schema: resolver(
                            z.object({
                                message: z.literal('Update task added'),
                            }),
                        ),
                    },
                },
            },
        },
    }),
    validator(
        'param',
        z.object({
            emoticonId: z.coerce
                .number()
                .int()
                .min(1)
                .describe('需要爬取的表情包 ID'),
        }),
    ),
    validator(
        'query',
        z.object({
            force: z
                .stringbool()
                .optional()
                .default(false)
                .describe('是否强制重新爬取已爬取过的表情包'),
        }),
    ),
    async ctx => {
        const param = ctx.req.valid('param');
        const query = ctx.req.valid('query');
        setImmediate(() =>
            fetchEmoticonWithCheck([param.emoticonId], query.force),
        );
        return ctx.json({ message: 'Update task added' });
    },
);

app.post(
    '/:emoticonIdRange{\\d+-\\d+}',
    describeRoute({
        description: '爬取一定范围内的多个表情包。需要管理员 Token。',
        responses: {
            200: {
                description: '',
                content: {
                    'application/json': {
                        schema: resolver(
                            z.object({
                                message: z.literal('Update task added'),
                            }),
                        ),
                    },
                },
            },
            400: {
                description: '',
                content: {
                    'application/json': {
                        schema: resolver(
                            z.object({
                                message: z.union([
                                    z.literal(
                                        'Only fetch up to 50 emoticons at a time',
                                    ),
                                    z.literal('Invalid range'),
                                ]),
                            }),
                        ),
                    },
                },
            },
        },
    }),
    validator(
        'param',
        z.object({
            emoticonIdRange: z
                .string()
                .regex(/^(\d+)-(\d+)$/)
                .describe('需要爬取的表情包 ID，格式示例：200000-200010'),
        }),
    ),
    validator(
        'query',
        z.object({
            force: z
                .stringbool()
                .optional()
                .default(false)
                .describe('是否强制重新爬取已爬取过的表情包'),
        }),
    ),
    async ctx => {
        const param = ctx.req.valid('param');
        const query = ctx.req.valid('query');
        // biome-ignore lint/style/noNonNullAssertion: 根据URL格式必定match
        const m = param.emoticonIdRange.match(/^(\d+)-(\d+)$/)!;
        const [from, to] = [
            Number.parseInt(m[1], 10),
            Number.parseInt(m[2], 10),
        ];
        if (from > to) return ctx.json({ message: 'Invalid range' }, 400);
        if (to - from > 50)
            return ctx.json(
                { message: 'Only fetch up to 50 emoticons at a time' },
                400,
            );
        setImmediate(() =>
            fetchEmoticonWithCheck(
                Array(to - from + 1)
                    .fill(0)
                    .map((_, i) => i + from),
                query.force,
            ),
        );
        return ctx.json({ message: 'Update tasks added' });
    },
);

app.get(
    '/status',
    describeRoute({
        description: '查看表情包的爬取结果。需要管理员 Token。',
        responses: {
            200: {
                description: '',
                content: {
                    'application/json': {
                        schema: resolver(
                            z.array(
                                z.object({
                                    time: z.iso.datetime(),
                                    emoticonId: z.number(),
                                    result: z.enum([
                                        'fetched',
                                        'unchanged',
                                        'failed',
                                    ]),
                                }),
                            ),
                        ),
                    },
                },
            },
        },
    }),
    async ctx => {
        return ctx.json(fetchEmoticonResults);
    },
);

export default app;
