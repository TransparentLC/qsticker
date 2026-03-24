import { and, count, desc, eq, like, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import config from '../config';
import db from '../database';
import { etag, validator } from '../middlewares';
import { emoticon, emoticonImage } from '../schema';

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
                                description: z.string().describe('表情包简介'),
                                icon: z.url().describe('图标 URL'),
                                updateTime: z.iso
                                    .datetime()
                                    .describe('更新时间（ISO 8601）'),
                                source: z.enum(['qq']).describe('表情包出处'),
                                archiveUrl: z.url().describe('打包下载 URL'),
                                archiveSize: z
                                    .number()
                                    .describe('打包下载的文件大小'),
                                animated: z
                                    .boolean()
                                    .describe('是否包含动态表情'),
                                images: z
                                    .array(
                                        z.object({
                                            keyword: z
                                                .string()
                                                .describe('表情关键词'),
                                            url: z
                                                .url()
                                                .describe('表情图片 URL'),
                                            preview: z
                                                .url()
                                                .describe('预览图片 URL'),
                                            animated: z
                                                .boolean()
                                                .describe('是否为动态表情'),
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
    etag(),
    async ctx => {
        const param = ctx.req.valid('param');
        const metadata = db
            .select({
                emoticonId: emoticon.emoticonId,
                name: emoticon.name,
                description: emoticon.description,
                icon: emoticon.icon,
                updateTime: emoticon.updateTime,
                source: emoticon.source,
                archiveUrl: emoticon.archiveUrl,
                archiveSize: emoticon.archiveSize,
                animated: emoticon.animated,
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
        const images = db
            .select({
                keyword: emoticonImage.keyword,
                url: emoticonImage.url,
                preview: sql<string>`IFNULL(${emoticonImage.preview}, ${emoticonImage.url})`,
                animated: emoticonImage.animated,
            })
            .from(emoticonImage)
            .where(eq(emoticonImage.emoticonId, metadata.emoticonId))
            .all();
        ctx.header('Cache-Control', 'public, max-age=3600');
        return ctx.json({ ...metadata, images });
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
                                            .describe('表情包简介'),
                                        icon: z.url().describe('图标 URL'),
                                        updateTime: z.iso
                                            .datetime()
                                            .describe('更新时间（ISO 8601）'),
                                        source: z
                                            .enum(['qq'])
                                            .describe('表情包出处'),
                                        archiveUrl: z
                                            .url()
                                            .describe('打包下载 URL'),
                                        archiveSize: z
                                            .number()
                                            .describe('打包下载的文件大小'),
                                        animated: z
                                            .boolean()
                                            .describe('是否包含动态表情'),
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
            keyword: z.string().trim().optional().describe('搜索关键词'),
            name: z
                .stringbool()
                .optional()
                .default(true)
                .describe('是否在表情包名称中搜索关键词'),
            description: z
                .stringbool()
                .optional()
                .default(false)
                .describe('是否在表情包简介中搜索关键词'),
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
            query.keyword && (query.name || query.description)
                ? or(
                      query.name
                          ? like(emoticon.name, `%${query.keyword}%`)
                          : undefined,
                      query.description
                          ? like(emoticon.description, `%${query.keyword}%`)
                          : undefined,
                  )
                : undefined,
            query.animated !== undefined
                ? eq(emoticon.animated, query.animated)
                : undefined,
        );
        // biome-ignore lint/style/noNonNullAssertion: count(*)必定存在
        const rowCount = db
            .select({ count: count() })
            .from(emoticon)
            .where(where)
            .get()!.count;
        const result = db
            .select({
                emoticonId: emoticon.emoticonId,
                name: emoticon.name,
                description: emoticon.description,
                icon: emoticon.icon,
                updateTime: emoticon.updateTime,
                source: emoticon.source,
                archiveUrl: emoticon.archiveUrl,
                archiveSize: emoticon.archiveSize,
                animated: emoticon.animated,
            })
            .from(emoticon)
            .where(where)
            .orderBy(desc(emoticon.updateTime))
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
