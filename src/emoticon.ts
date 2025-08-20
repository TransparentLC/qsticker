import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import stream from 'node:stream';
import AdmZip from 'adm-zip';
import { execa } from 'execa';
import { type Frame, parseGIF } from 'gifuct-js';
import pLimit from 'p-limit';
import wretch from 'wretch';
import config from './config';
import type { emoticon as emoticonSchema } from './schema';

type Emoticon = typeof emoticonSchema.$inferSelect;

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

// 从 xydata.json 解析表情包信息
export const parseEmoticonMetadata = async (
    emoticonId: number,
    metadata: EmoticonMetadata,
): Promise<Emoticon> => {
    const animatedCheckMd5 =
        metadata.data.md5Info[
            Math.floor(Math.random() * metadata.data.md5Info.length)
        ].md5;
    const animateCheckGIF = await wretch(
        makeEmoticonUrl(animatedCheckMd5, 'raw200.gif'),
    )
        .get()
        .arrayBuffer()
        .then(r => parseGIF(r));
    const animated =
        animateCheckGIF.frames.filter(e => (e as Frame).image).length > 1;
    return {
        emoticonId,
        name: metadata.data.baseInfo[0].name,
        description: metadata.data.baseInfo[0].desc,
        icon: `https://i.gtimg.cn/club/item/parcel/img/parcel/${emoticonId % 10}/${emoticonId}/200x200.png`,
        archiveUrl: '',
        archiveSize: 0,
        animated,
        images: metadata.data.md5Info.map(e => ({
            keyword: e.name,
            src: makeEmoticonUrl(
                e.md5,
                animated ? 'raw300.gif' : '300x300.png',
            ),
            // preview: makeEmoticonUrl(e.md5, '126x126.png'),
            preview: makeEmoticonUrl(e.md5, '300x300.png'),
        })),
        metadata,
    };
};

// 根据表情包 ID 获取表情包信息
export const fetchEmoticon = (emoticonId: number) =>
    wretch(
        `https://gxh.vip.qq.com/qqshow/admindata/comdata/vipEmoji_item_${emoticonId}/xydata.json`,
        // `https://p.qpic.cn/CDN_STATIC/0/data/imgcache/htdocs/qqshow/admindata/comdata/vipEmoji_item_${emoticonId}/xydata.json`,
    )
        .get()
        .json<EmoticonMetadata>()
        .then(r => parseEmoticonMetadata(emoticonId, r));

// 根据表情包信息信息下载表情包，对 PNG 或 GIF 进行压缩，然后打包为 ZIP 压缩包
export const archiveEmoticon = async (
    emoticon: Emoticon,
    archivePath: string,
) => {
    const limit = pLimit(4);
    const images = await Promise.all(
        [
            { keyword: '', src: emoticon.icon, isIcon: true },
            ...emoticon.images.map(e => ({ ...e, isIcon: false })),
        ].map(e =>
            limit(async () => {
                const file = path.join(os.tmpdir(), crypto.randomUUID());
                console.log(
                    'Archiving emoticon',
                    emoticon.emoticonId,
                    'Download',
                    e.src,
                    'to',
                    file,
                );
                await wretch(e.src)
                    .get()
                    .res(r =>
                        r.body?.pipeTo(
                            stream.Writable.toWeb(fs.createWriteStream(file)),
                        ),
                    );
                return {
                    keyword: e.keyword,
                    file,
                    size: (await fs.promises.stat(file)).size,
                    isIcon: e.isIcon,
                };
            }),
        ),
    );
    const zip = new AdmZip();
    const root = `${emoticon.emoticonId} - ${emoticon.name}`;
    for (const image of images) {
        if (config.optimize.gif && emoticon.animated && !image.isIcon) {
            await execa(
                'gifsicle',
                [
                    ...(config.optimize.gif.verbose ? ['--verbose'] : []),
                    '--optimize=3',
                    ...(config.optimize.gif.lossy
                        ? [
                              `--lossy${typeof config.optimize.gif.lossy === 'number' ? `=${config.optimize.gif.lossy}` : ''}`,
                          ]
                        : []),
                    `--threads=${os.availableParallelism()}`,
                    '--output',
                    image.file,
                    image.file,
                ],
                { stdout: 'inherit', stderr: 'inherit' },
            );
        } else if (config.optimize.png) {
            await execa(
                'oxipng',
                [
                    ...(config.optimize.png.verbose
                        ? ['--verbose', '--verbose']
                        : []),
                    '--opt',
                    'max',
                    image.file,
                ],
                { stdout: 'inherit', stderr: 'inherit' },
            );
        }
        const sizeOptimized = (await fs.promises.stat(image.file)).size;
        console.log(
            'Archiving emoticon',
            emoticon.emoticonId,
            'Optimized',
            image.file,
            'from',
            image.size,
            'to',
            sizeOptimized,
            `(${((sizeOptimized / image.size - 1) * 100).toFixed(2)}%)`,
        );
        await new Promise((resolve, reject) =>
            zip.addLocalFileAsync(
                {
                    localPath: image.file,
                    zipPath: image.isIcon ? root : path.join(root, 'emoticon'),
                    zipName: image.isIcon
                        ? 'icon.png'
                        : `${image.keyword}.${emoticon.animated ? 'gif' : 'png'}`,
                },
                (err, done) => (err ? reject(err) : resolve(done)),
            ),
        );
        await fs.promises.unlink(image.file);
    }
    zip.addFile(
        path.join(root, 'metadata.json'),
        Buffer.from(JSON.stringify(emoticon.metadata, null, 2)),
    );
    await zip.writeZipPromise(archivePath);
    console.log(
        'Archiving emoticon',
        emoticon.emoticonId,
        'Saved archive in',
        archivePath,
        'Size:',
        (await fs.promises.stat(archivePath)).size,
    );
};
