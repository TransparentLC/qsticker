import { count, desc, eq, like } from 'drizzle-orm';
import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import config from '../config';
import db from '../database';
import { validator } from '../middlewares';
import { emoticon } from '../schema';

const app = new Hono<HonoSchema>();

app.get(
    '/:emoticonId{\\d+}',
    describeRoute({
        description: '获取单个表情包信息',
        responses: {
            200: {
                description: '',
                content: {
                    'application/json': {
                        schema: resolver(
                            z.object({
                                emoticonId: z.number().describe('表情包 ID'),
                                name: z.string().describe('表情包名称'),
                                description: z.string().describe('表情包说明'),
                                icon: z.url().describe('图标 URL'),
                                archiveUrl: z.url().describe('打包下载 URL'),
                                archiveSize: z
                                    .number()
                                    .describe('打包下载的文件大小'),
                                animated: z
                                    .boolean()
                                    .describe('是否为动态表情'),
                                images: z
                                    .array(
                                        z.object({
                                            keyword: z
                                                .string()
                                                .describe('表情备注'),
                                            src: z
                                                .url()
                                                .describe('表情图片 URL'),
                                            preview: z
                                                .url()
                                                .describe(
                                                    '预览图片 URL，即使是动态表情此处也会使用静态图片',
                                                ),
                                        }),
                                    )
                                    .describe('表情包图片信息'),
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
            emoticonId: z.coerce.number().int().min(1).describe('表情包 ID'),
        }),
    ),
    async ctx => {
        const param = ctx.req.valid('param');
        const metadata = db
            .select({
                emoticonId: emoticon.emoticonId,
                name: emoticon.name,
                description: emoticon.description,
                icon: emoticon.icon,
                archiveUrl: emoticon.archiveUrl,
                archiveSize: emoticon.archiveSize,
                animated: emoticon.animated,
                images: emoticon.images,
            })
            .from(emoticon)
            .where(eq(emoticon.emoticonId, param.emoticonId))
            .get();
        if (!metadata) {
            return ctx.body(null, 404);
        }
        if (!metadata.archiveUrl.match(/^https?:\/\//)) {
            // 'https://example.com' + '/prefix/' + 'storage/foobar.zip'
            metadata.archiveUrl =
                new URL(ctx.req.url).origin +
                config.server.base +
                metadata.archiveUrl;
        }
        ctx.header('Cache-Control', 'public, max-age=3600');
        return ctx.json(metadata);
    },
);

app.get(
    '/',
    describeRoute({
        description: '获取（搜索的）表情包列表',
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
                                        emoticonId: z
                                            .number()
                                            .describe('表情包 ID'),
                                        name: z.string().describe('表情包名称'),
                                        description: z
                                            .string()
                                            .describe('表情包说明'),
                                        icon: z.url().describe('图标 URL'),
                                        archiveUrl: z
                                            .url()
                                            .describe('打包下载 URL'),
                                        archiveSize: z
                                            .number()
                                            .describe('打包下载的文件大小'),
                                        animated: z
                                            .boolean()
                                            .describe('是否为动态表情'),
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
            keyword: z.string().optional().describe('搜索关键词'),
            page: z.coerce
                .number()
                .int()
                .min(1)
                .optional()
                .default(1)
                .describe('查看页数'),
        }),
    ),
    async ctx => {
        const query = ctx.req.valid('query');
        // biome-ignore lint/style/noNonNullAssertion: count(*)必定存在
        const rowCount = db
            .select({ count: count() })
            .from(emoticon)
            .where(
                query.keyword
                    ? like(emoticon.name, `%${query.keyword}%`)
                    : undefined,
            )
            .get()!.count;
        const result = db
            .select({
                emoticonId: emoticon.emoticonId,
                name: emoticon.name,
                description: emoticon.description,
                icon: emoticon.icon,
                archiveUrl: emoticon.archiveUrl,
                archiveSize: emoticon.archiveSize,
                animated: emoticon.animated,
            })
            .from(emoticon)
            .where(
                query.keyword
                    ? like(emoticon.name, `%${query.keyword}%`)
                    : undefined,
            )
            .orderBy(desc(emoticon.emoticonId))
            .limit(10)
            .offset((query.page - 1) * 10)
            .all()
            .map(e => {
                if (!e.archiveUrl.match(/^https?:\/\//)) {
                    // 'https://example.com' + '/prefix/' + 'storage/foobar.zip'
                    e.archiveUrl =
                        new URL(ctx.req.url).origin +
                        config.server.base +
                        e.archiveUrl;
                }
                return e;
            });

        return ctx.json({
            count: rowCount,
            pages: Math.ceil(rowCount / 10),
            result,
        });
    },
);

export default app;
