import { and, count, desc, eq, like, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import db from '../../database';
import { etag, validator } from '../../middlewares';
import { emoticon, emoticonImage } from '../../schema';

const app = new Hono<HonoSchema>();

app.get(
    '/',
    describeRoute({
        description: '搜索单个表情',
        responses: {
            200: {
                description: '',
                content: {
                    'application/json': {
                        schema: resolver(
                            z.object({
                                count: z.number().describe('表情包总数'),
                                pages: z.number().describe('总页数'),
                                result: z.array(
                                    z.object({
                                        emoticonImageId: z
                                            .number()
                                            .describe(
                                                '表情图片 ID（仅限内部使用，没有意义）',
                                            ),
                                        keyword: z
                                            .string()
                                            .describe('表情关键词'),
                                        url: z.url().describe('表情图片 URL'),
                                        preview: z
                                            .url()
                                            .describe('预览图片 URL'),
                                        animated: z
                                            .boolean()
                                            .describe('是否为动态表情'),
                                        emoticon: z
                                            .object({
                                                emoticonId: z
                                                    .number()
                                                    .describe('表情包 ID'),
                                                name: z
                                                    .string()
                                                    .describe('表情包名称'),
                                                updateTime: z.iso
                                                    .datetime()
                                                    .describe(
                                                        '表情包更新时间（ISO 8601）',
                                                    ),
                                                source: z
                                                    .enum(['qq'])
                                                    .describe('表情包出处'),
                                            })
                                            .describe('所属表情包信息'),
                                    }),
                                ),
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
            keyword: z.string().trim().min(1).describe('搜索关键词'),
            animated: z
                .stringbool()
                .optional()
                .describe('是否只搜索动态/静态表情包'),
            page: z.coerce
                .number()
                .int()
                .min(1)
                .optional()
                .default(1)
                .describe('查看页数'),
        }),
    ),
    etag(),
    async ctx => {
        const query = ctx.req.valid('query');
        const where = and(
            like(emoticonImage.keyword, `%${query.keyword}%`),
            query.animated !== undefined
                ? eq(emoticonImage.animated, query.animated)
                : undefined,
        );
        // biome-ignore lint/style/noNonNullAssertion: count(*)必定存在
        const rowCount = db
            .select({ count: count() })
            .from(emoticonImage)
            .where(where)
            .get()!.count;
        const result = db
            .select({
                emoticonImageId: emoticonImage.emoticonImageId,
                keyword: emoticonImage.keyword,
                url: emoticonImage.url,
                preview: sql<string>`IFNULL(${emoticonImage.preview}, ${emoticonImage.url})`,
                animated: emoticonImage.animated,
                emoticon: {
                    emoticonId: emoticon.emoticonId,
                    name: emoticon.name,
                    updateTime: emoticon.updateTime,
                    source: emoticon.source,
                },
            })
            .from(emoticonImage)
            .where(where)
            .innerJoin(
                emoticon,
                eq(emoticonImage.emoticonId, emoticon.emoticonId),
            )
            .orderBy(desc(emoticon.updateTime))
            .limit(20)
            .offset((query.page - 1) * 20)
            .all();

        return ctx.json({
            count: rowCount,
            pages: Math.ceil(rowCount / 20),
            result,
        });
    },
);

export default app;
