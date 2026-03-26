import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import stream from 'node:stream';
import AdmZip from 'adm-zip';
import { and, eq, inArray, max, sql } from 'drizzle-orm';
import { execa } from 'execa';
import fg from 'fast-glob';
import { type Frame, parseGIF } from 'gifuct-js';
import cron from 'node-cron';
import pLimit from 'p-limit';
import type { WretchError } from 'wretch';
import wretch from 'wretch';
import config from './config';
import db from './database';
import createLogger from './logger';
import {
    emoticon,
    emoticonImage,
    type emoticonImage as emoticonImageSchema,
    type emoticon as emoticonSchema,
} from './schema';

type Emoticon = typeof emoticonSchema.$inferSelect;
type EmoticonImage = typeof emoticonImageSchema.$inferSelect;

const emoticonLogger = createLogger('emoticon');
const updateLogger = createLogger('update');

const httpLimit = pLimit(32);
const cpuLimit = pLimit(os.availableParallelism());

/**
 * 解析表情包信息，并下载表情包然后打包为 ZIP 压缩包
 *
 * @param emoticonId
 * @param source
 * @returns
 */
export const archiveEmoticon = async (
    emoticonId: number,
    source: EmoticonSource,
): Promise<[Emoticon, EmoticonImage[]]> => {
    emoticonLogger.info('Archiving emoticon %d (%s)', emoticonId, source);

    // 解析表情包信息
    let emoticon: Emoticon;
    let emoticonImages: EmoticonImage[];
    let metadata:
        | EmoticonMetadata.QQ
        | EmoticonMetadata.Bilibili
        | EmoticonMetadata.BilibiliLegacy;
    switch (source) {
        case 'qq': {
            const makeEmoticonUrl = (
                md5: string,
                type:
                    | '126x126.png'
                    | '200x200.png'
                    | '300x300.png'
                    | 'raw200.gif'
                    | 'raw300.gif',
            ) =>
                `https://i.gtimg.cn/club/item/parcel/item/${md5.substring(0, 2)}/${md5}/${type}`;

            metadata = (await httpLimit(() =>
                wretch(
                    `https://i.gtimg.cn/club/item/parcel/${emoticonId % 10}/${emoticonId}.json`,
                )
                    .get()
                    .json<EmoticonMetadata.QQ>(),
            )) as EmoticonMetadata.QQ;
            emoticon = {
                emoticonId,
                name: metadata.name,
                description: metadata.mark,
                icon: `https://i.gtimg.cn/club/item/parcel/img/parcel/${emoticonId % 10}/${emoticonId}/200x200.png`,
                updateTime: new Date(metadata.updateTime * 1e3).toISOString(),
                source: 'qq',
                animated: false,
                archiveSize: NaN,
                archiveUrl: '',
                extra: null,
            };
            emoticonImages = metadata.imgs.map(
                (e, i) =>
                    <EmoticonImage>{
                        emoticonId,
                        emoticonImageId: emoticonId * 100 + i,
                        keyword: e.name,
                        url: makeEmoticonUrl(e.id, 'raw300.gif'),
                        preview: makeEmoticonUrl(e.id, '300x300.png'),
                        animated: false,
                    },
            );
            break;
        }
        case 'bilibili': {
            metadata = (await httpLimit(() =>
                wretch(
                    `https://api.bilibili.com/x/garb/v2/user/suit/benefit?part=cards&item_id=${emoticonId}`,
                )
                    .get()
                    .json<{
                        code: number;
                        message: string;
                        ttl: number;
                        data:
                            | EmoticonMetadata.Bilibili
                            | EmoticonMetadata.BilibiliLegacy
                            | null;
                    }>()
                    .then(r => {
                        if (r.data === null)
                            throw new Error(
                                `Bilibili emoticon #${emoticonId} not found`,
                            );
                        return r.data;
                    }),
            )) as EmoticonMetadata.Bilibili | EmoticonMetadata.BilibiliLegacy;
            const actId = parseInt(
                // biome-ignore lint/style/noNonNullAssertion: no reason
                new URL(metadata.buy_link).searchParams.get('act_id')!,
                10,
            );
            const actBasic = await httpLimit(() =>
                wretch(
                    `https://api.bilibili.com/x/vas/dlc_act/act/basic?act_id=${actId}`,
                )
                    .get()
                    .json<{
                        code: number;
                        message: string;
                        ttl: number;
                        data: BilibiliActBasic;
                    }>()
                    .then(r => {
                        if (r.code) throw new Error(r.message);
                        return r.data;
                    }),
            );
            const actAssetBag = await httpLimit(() =>
                wretch(
                    `https://api.bilibili.com/x/vas/dlc_act/asset_bag?act_id=${actId}`,
                )
                    .get()
                    .json<{
                        code: number;
                        message: string;
                        ttl: number;
                        data: BilibiliActAssetBag;
                    }>()
                    .then(r => {
                        if (r.code) throw new Error(r.message);
                        return r.data;
                    }),
            );
            emoticon = {
                emoticonId,
                name: metadata.name,
                description: actBasic.product_introduce,
                icon: metadata.properties.image,
                updateTime: new Date(
                    // biome-ignore lint/style/noNonNullAssertion: no reason
                    actAssetBag.collect_list!.find(
                        e => parseInt(e.redeem_item_id, 10) === emoticonId,
                    )!.start_time * 1000,
                ).toISOString(),
                source: 'bilibili',
                animated: false,
                archiveSize: NaN,
                archiveUrl: '',
                extra: <EmoticonExtra.Bilibili>{ actId },
            };
            if (
                (metadata as EmoticonMetadata.Bilibili).properties
                    .item_emoji_list
            ) {
                emoticonImages = (
                    JSON.parse(
                        (metadata as EmoticonMetadata.Bilibili).properties
                            .item_emoji_list,
                    ) as {
                        name: string;
                        image_webp?: string;
                        image_gif?: string;
                        image: string;
                    }[]
                ).map(
                    (e, i) =>
                        <EmoticonImage>{
                            emoticonId,
                            emoticonImageId: emoticonId * 100 + i,
                            keyword: e.name,
                            url: e.image_gif || e.image,
                            preview: e.image_gif ? e.image : null,
                            animated: Boolean(e.image_gif),
                        },
                );
            } else if (
                (metadata as EmoticonMetadata.BilibiliLegacy).properties
                    .item_ids
            ) {
                emoticonImages = (
                    metadata as EmoticonMetadata.BilibiliLegacy
                ).suit_items.emoji.map(
                    (e, i) =>
                        <EmoticonImage>{
                            emoticonId,
                            emoticonImageId: emoticonId * 100 + i,
                            // biome-ignore lint/style/noNonNullAssertion: no reason
                            keyword: e.name.match(/^\[.+?_(.+?)\]$/)![1],
                            url: e.properties.image_gif || e.properties.image,
                            preview: e.properties.image_gif
                                ? e.properties.image
                                : null,
                            animated: Boolean(e.properties.image_gif),
                        },
                );
            } else {
                throw new Error('Cannot get emoticon images data');
            }
            emoticon.animated = emoticonImages.some(e => e.animated);
            break;
        }
        default:
            throw new Error(`Unknown emoticon source: ${source}`);
    }

    // 下载表情包
    const archiveDir = path.join(os.tmpdir(), crypto.randomUUID());
    const archiveEmoticonDir = path.join(archiveDir, 'emoticon');
    await fs.promises.mkdir(archiveEmoticonDir, { recursive: true });
    await httpLimit(() =>
        wretch(emoticon.icon)
            .get()
            .res(r =>
                r.body?.pipeTo(
                    stream.Writable.toWeb(
                        fs.createWriteStream(path.join(archiveDir, 'icon.png')),
                    ),
                ),
            ),
    );
    await Promise.all(
        emoticonImages.map(async e => {
            let data = await httpLimit(() =>
                wretch(e.url)
                    .get()
                    .res(r => r.arrayBuffer()),
            );
            if (source === 'qq') {
                e.animated =
                    parseGIF(data).frames.filter(e => (e as Frame).image)
                        .length > 1;
                if (!e.animated) {
                    e.url = e.url.replace(/\/raw300\.gif/g, '/300x300.png');
                    e.preview = null;
                    data = await httpLimit(() =>
                        wretch(e.url)
                            .get()
                            .res(r => r.arrayBuffer()),
                    );
                }
            }
            await fs.promises.writeFile(
                path.join(
                    archiveEmoticonDir,
                    `${e.keyword}.${e.animated ? 'gif' : 'png'}`,
                ),
                new Uint8Array(data),
            );
        }),
    );

    // 压缩表情包图片
    const optimizeStart = performance.now();
    if (config.optimize.gif) {
        const entries = await fg.glob(
            path.join(archiveDir, '**', '*.gif').replaceAll(path.sep, '/'),
        );
        await Promise.all(
            entries.map(e =>
                cpuLimit(async () => {
                    const sizeBefore = await fs.promises
                        .stat(e)
                        .then(r => r.size);
                    await execa(
                        'gifsicle',
                        [
                            ...(config.optimize.gif.verbose
                                ? ['--verbose']
                                : []),
                            '--optimize=3',
                            ...(config.optimize.gif.lossy
                                ? [
                                      `--lossy${typeof config.optimize.gif.lossy === 'number' ? `=${config.optimize.gif.lossy}` : ''}`,
                                  ]
                                : []),
                            '--output',
                            e,
                            e,
                        ],
                        { stdout: 'inherit', stderr: 'inherit' },
                    );
                    const sizeAfter = await fs.promises
                        .stat(e)
                        .then(r => r.size);
                    emoticonLogger.info(
                        'Archiving emoticon %d (%s) Optimized GIF %s from %d to %d (Saved %s%%)',
                        emoticonId,
                        source,
                        e,
                        sizeBefore,
                        sizeAfter,
                        ((1 - sizeAfter / sizeBefore) * 100).toFixed(2),
                    );
                }),
            ),
        );
    }
    if (config.optimize.png) {
        const entries = await fg.glob(
            path.join(archiveDir, '**', '*.png').replaceAll(path.sep, '/'),
        );
        await Promise.all(
            entries.map(e =>
                cpuLimit(async () => {
                    const sizeBefore = await fs.promises
                        .stat(e)
                        .then(r => r.size);
                    await execa(
                        'oxipng',
                        [
                            ...(config.optimize.png.verbose
                                ? ['--verbose', '--verbose']
                                : ['--quiet']),
                            '--sequential',
                            '--opt',
                            'max',
                            '--fast',
                            '--strip',
                            'safe',
                            '--alpha',
                            ...(config.optimize.png.zopfli
                                ? [
                                      '--zopfli',
                                      ...(typeof config.optimize.png.zopfli ===
                                      'number'
                                          ? [
                                                '--zi',
                                                config.optimize.png.zopfli.toString(),
                                            ]
                                          : []),
                                  ]
                                : []),
                            e,
                        ],
                        { stdout: 'inherit', stderr: 'inherit' },
                    );
                    const sizeAfter = await fs.promises
                        .stat(e)
                        .then(r => r.size);
                    emoticonLogger.info(
                        'Archiving emoticon %d (%s) Optimized PNG %s from %d to %d (Saved %s%%)',
                        emoticonId,
                        source,
                        e,
                        sizeBefore,
                        sizeAfter,
                        ((1 - sizeAfter / sizeBefore) * 100).toFixed(2),
                    );
                }),
            ),
        );
    }
    const optimizeEnd = performance.now();
    emoticonLogger.info(
        'Optimized emoticon %d (%s) in %ds',
        emoticonId,
        source,
        (optimizeEnd - optimizeStart) / 1000,
    );

    // 打包为 ZIP 压缩包
    const archivePath = `${archiveDir}.zip`;
    const archive = new AdmZip();
    const root = `${emoticon.emoticonId} - ${emoticon.name}`;
    const entries = await fg.glob(
        path.join('**', '*').replaceAll(path.sep, '/'),
        { cwd: archiveDir },
    );
    await Promise.all(
        entries.map(
            e =>
                new Promise((resolve, reject) =>
                    archive.addLocalFileAsync(
                        {
                            localPath: path.join(archiveDir, e),
                            zipPath: root,
                            zipName: e,
                        },
                        (err, done) => (err ? reject(err) : resolve(done)),
                    ),
                ),
        ),
    );
    archive.addFile(
        path.join(root, 'metadata.json'),
        Buffer.from(JSON.stringify(metadata, null, 2)),
    );
    await archive.writeZipPromise(archivePath);
    await fs.promises.rm(archiveDir, { recursive: true });
    const archiveSize = await fs.promises.stat(archivePath).then(r => r.size);
    emoticonLogger.info(
        'Archiving emoticon %d (%s) Saved archive in %s Size: %d',
        emoticonId,
        source,
        archivePath,
        archiveSize,
    );

    emoticon.animated = emoticonImages.some(e => e.animated);
    emoticon.archiveUrl = archivePath;
    emoticon.archiveSize = archiveSize;

    return [emoticon, emoticonImages];
};

type FetchEmoticonResult = {
    time: Date;
    emoticonId: number;
    source: EmoticonSource;
    result: 'fetched' | 'unchanged' | 'notfound' | 'failed';
};

/** 下载表情包的任务结果 */
export const fetchEmoticonResults: FetchEmoticonResult[] = [];
const fetchEmoticonResultsAppend = (
    result: Omit<FetchEmoticonResult, 'time'>,
) => {
    while (fetchEmoticonResults.length > 50) fetchEmoticonResults.pop();
    fetchEmoticonResults.unshift({ time: new Date(), ...result });
};

/**
 * 检查多个表情包 ID 是否已下载，将未下载的表情包下载并写入数据库
 *
 * @param emoticonIdSources
 * @param force
 * @returns
 */
export const fetchEmoticonsWithCheck = (
    emoticonIdSources: [number, EmoticonSource][],
    force: boolean,
) =>
    Promise.all(
        emoticonIdSources.map(async ([emoticonId, source]) => {
            const metadataCheckFetched = db
                .select({ archiveUrl: emoticon.archiveUrl })
                .from(emoticon)
                .where(
                    and(
                        eq(emoticon.emoticonId, emoticonId),
                        eq(emoticon.source, source),
                    ),
                )
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
                updateLogger.info(
                    'Already archived emoticon %d (%s)',
                    emoticonId,
                    source,
                );
                return fetchEmoticonResultsAppend({
                    emoticonId,
                    source,
                    result: 'unchanged',
                });
            }
            try {
                const [metadata, images] = await archiveEmoticon(
                    emoticonId,
                    source,
                );
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
                try {
                    await fs.promises.rename(metadata.archiveUrl, archivePath);
                } catch (err) {
                    if ((err as NodeJS.ErrnoException).code !== 'EXDEV')
                        throw err;
                    await fs.promises.copyFile(
                        metadata.archiveUrl,
                        archivePath,
                    );
                    await fs.promises.rm(metadata.archiveUrl);
                }
                metadata.archiveUrl = `${archivePath.replaceAll(path.sep, '/')}`;
                db.delete(emoticonImage)
                    .where(
                        inArray(
                            emoticonImage.emoticonImageId,
                            images.map(e => e.emoticonImageId),
                        ),
                    )
                    .run();
                db.delete(emoticon)
                    .where(eq(emoticon.emoticonId, emoticonId))
                    .run();
                db.insert(emoticon).values(metadata).run();
                db.insert(emoticonImage).values(images).run();
                updateLogger.info(
                    'Updated emoticon %d (%s)',
                    emoticonId,
                    source,
                );
                return fetchEmoticonResultsAppend({
                    emoticonId,
                    source,
                    result: 'fetched',
                });
            } catch (e) {
                if ((e as WretchError)?.status === 404) {
                    return fetchEmoticonResultsAppend({
                        emoticonId,
                        source,
                        result: 'notfound',
                    });
                } else {
                    updateLogger.error(
                        'Error on updating emoticon %d (%s): %s',
                        emoticonId,
                        source,
                        e,
                    );
                    return fetchEmoticonResultsAppend({
                        emoticonId,
                        source,
                        result: 'failed',
                    });
                }
            }
        }),
    );

/**
 * 从最新的表情包 ID 开始获取新的表情包
 *
 * @param source
 */
export const emoticonUpdateTrigger = async (source: EmoticonSource) => {
    switch (source) {
        case 'qq': {
            // biome-ignore lint/style/noNonNullAssertion: max()必定存在
            const emoticonId = db
                .select({ emoticonId: max(emoticon.emoticonId) })
                .from(emoticon)
                .where(eq(emoticon.source, 'qq'))
                .get()!.emoticonId!;
            const from = emoticonId - config.update.range.qq;
            const to = emoticonId + config.update.range.qq;
            updateLogger.info(
                'Update emoticon source %s from %d to %d',
                source,
                from,
                to,
            );
            fetchEmoticonsWithCheck(
                Array(to - from + 1)
                    .fill(0)
                    .map((_, i) => [i + from, 'qq']),
                false,
            );
            break;
        }
        case 'bilibili': {
            // biome-ignore lint/style/noNonNullAssertion: actId必定存在
            const actId = db
                .select({
                    actId: sql<number>`max(json_extract(${emoticon.extra}, '$.actId'))`,
                })
                .from(emoticon)
                .where(eq(emoticon.source, 'bilibili'))
                .get()!.actId!;
            const from = actId - config.update.range.bilibili;
            const to = actId + config.update.range.bilibili;
            updateLogger.info(
                'Update emoticon source %s from %d to %d',
                source,
                from,
                to,
            );
            const emoticonId = await Promise.all(
                Array(to - from + 1)
                    .fill(0)
                    .map(async (_, i) => {
                        const actId = i + from;
                        const actAssetBag = await httpLimit(() =>
                            wretch(
                                `https://api.bilibili.com/x/vas/dlc_act/asset_bag?act_id=${actId}`,
                            )
                                .get()
                                .json<{
                                    code: number;
                                    message: string;
                                    ttl: number;
                                    data: BilibiliActAssetBag;
                                }>()
                                .then(r =>
                                    r.code
                                        ? <BilibiliActAssetBag>{
                                              collect_list: [],
                                          }
                                        : r.data,
                                ),
                        );
                        return (
                            actAssetBag.collect_list
                                ?.filter(
                                    e =>
                                        e.redeem_item_type === 2 ||
                                        e.redeem_item_type === 15,
                                )
                                .map(e => parseInt(e.redeem_item_id, 10)) ?? []
                        );
                    }),
            ).then(r => r.flat());
            fetchEmoticonsWithCheck(
                emoticonId.map(e => [e, 'bilibili']),
                false,
            );
            break;
        }
        default:
            throw new Error(`Unknown emoticon source: ${source}`);
    }
};

if (config.update.cron) {
    updateLogger.info('Cron update emoticon at %s', config.update.cron);
    for (const source of ['qq', 'bilibili'] as EmoticonSource[]) {
        cron.schedule(config.update.cron, () => {
            updateLogger.info('Cron update emoticon source %s', source);
            emoticonUpdateTrigger(source);
        });
    }
}
