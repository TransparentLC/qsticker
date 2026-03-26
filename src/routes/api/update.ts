import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import config from '../../config';
import {
    emoticonUpdateTrigger,
    fetchEmoticonResults,
    fetchEmoticonsWithCheck,
} from '../../emoticon';
import { validator } from '../../middlewares';

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
            source: z.enum(['qq', 'bilibili']).describe('爬取的表情包出处'),
        }),
    ),
    async ctx => {
        const param = ctx.req.valid('param');
        const query = ctx.req.valid('query');
        setImmediate(() =>
            fetchEmoticonsWithCheck(
                [[param.emoticonId, query.source]],
                query.force,
            ),
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
            source: z.enum(['qq', 'bilibili']).describe('爬取的表情包出处'),
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
            fetchEmoticonsWithCheck(
                Array(to - from + 1)
                    .fill(0)
                    .map((_, i) => [i + from, query.source]),
                query.force,
            ),
        );
        return ctx.json({ message: 'Update tasks added' });
    },
);

app.post(
    '/trigger',
    describeRoute({
        description:
            '根据最新爬取的表情包 ID 和设定的范围爬取最近更新的表情包。需要管理员 Token。',
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
        'query',
        z.object({
            source: z.enum(['qq', 'bilibili']).describe('爬取的表情包出处'),
        }),
    ),
    async ctx => {
        const query = ctx.req.valid('query');
        setImmediate(() => emoticonUpdateTrigger(query.source));
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
                                    source: z.enum(['qq', 'bilibili']),
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
