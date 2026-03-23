import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import stream from 'node:stream';
import AdmZip from 'adm-zip';
import { execa } from 'execa';
import fg from 'fast-glob';
import { type Frame, parseGIF } from 'gifuct-js';
import pLimit from 'p-limit';
import wretch from 'wretch';
import config from './config';
import type {
    emoticonImage as emoticonImageSchema,
    emoticon as emoticonSchema,
} from './schema';

type Emoticon = typeof emoticonSchema.$inferSelect;
type EmoticonImage = typeof emoticonImageSchema.$inferSelect;

const isAnimatedGIF = (data: ArrayBuffer) =>
    parseGIF(data).frames.filter(e => (e as Frame).image).length > 1;

export const archiveEmoticon = async (
    emoticonId: number,
): Promise<[Emoticon, EmoticonImage[]]> => {
    // 解析表情包信息
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

    const metadata = await wretch(
        `https://i.gtimg.cn/club/item/parcel/${emoticonId % 10}/${emoticonId}.json`,
    )
        .get()
        .json<EmoticonMetadata>();

    const emoticon: Emoticon = {
        emoticonId,
        name: metadata.name,
        description: metadata.mark,
        icon: `https://i.gtimg.cn/club/item/parcel/img/parcel/${emoticonId % 10}/${emoticonId}/200x200.png`,
        updateTime: new Date(metadata.updateTime * 1e3).toISOString(),
        source: 'qq',
        animated: false,
        archiveSize: NaN,
        archiveUrl: '',
    };
    const emoticonImages = metadata.imgs.map(
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
    const archiveDir = path.join(os.tmpdir(), crypto.randomUUID());
    const archiveEmoticonDir = path.join(archiveDir, 'emoticon');
    await fs.promises.mkdir(archiveEmoticonDir, { recursive: true });

    // 下载表情包图标
    await wretch(emoticon.icon)
        .get()
        .res(r =>
            r.body?.pipeTo(
                stream.Writable.toWeb(
                    fs.createWriteStream(path.join(archiveDir, 'icon.png')),
                ),
            ),
        );

    // 下载表情包
    const downloadLimit = pLimit(4);
    await Promise.all(
        emoticonImages.map(e =>
            downloadLimit(async () => {
                let data = await wretch(e.url)
                    .get()
                    .res(r => r.arrayBuffer());
                e.animated = isAnimatedGIF(data);
                if (!e.animated) {
                    e.url = e.url.replace(/\/raw300\.gif/g, '/300x300.png');
                    e.preview = null;
                    data = await wretch(e.url)
                        .get()
                        .res(r => r.arrayBuffer());
                }
                await fs.promises.writeFile(
                    path.join(
                        archiveEmoticonDir,
                        `${e.keyword}.${e.animated ? 'gif' : 'png'}`,
                    ),
                    new Uint8Array(data),
                );
            }),
        ),
    );

    // 压缩表情包图片
    const optimizeStart = performance.now();
    if (config.optimize.gif) {
        const gifLimit = pLimit(os.availableParallelism());
        const entries = await fg.glob(
            path.join(archiveDir, '**', '*.gif').replaceAll(path.sep, '/'),
        );
        await Promise.all(
            entries.map(e =>
                gifLimit(async () => {
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
                    console.log(
                        'Archiving emoticon',
                        emoticon.emoticonId,
                        'Optimized GIF',
                        e,
                        'from',
                        sizeBefore,
                        'to',
                        sizeAfter,
                        `(${((sizeAfter / sizeBefore - 1) * 100).toFixed(2)}%)`,
                    );
                }),
            ),
        );
    }
    if (config.optimize.png) {
        const entries = await fg.glob(
            path.join(archiveDir, '**', '*.png').replaceAll(path.sep, '/'),
        );
        const sizeBefore = await Promise.all(
            entries.map(e => fs.promises.stat(e).then(r => r.size)),
        ).then(r => r.reduce((a, c) => a + c, 0));
        await execa(
            'oxipng',
            [
                ...(config.optimize.png.verbose
                    ? ['--verbose', '--verbose']
                    : []),
                '--opt',
                'max',
                '--fast',
                '--strip',
                'safe',
                '--alpha',
                ...(config.optimize.png.zopfli
                    ? [
                          '--zopfli',
                          ...(typeof config.optimize.png.zopfli === 'number'
                              ? ['--zi', config.optimize.png.zopfli.toString()]
                              : []),
                      ]
                    : []),
                ...entries,
            ],
            { stdout: 'inherit', stderr: 'inherit' },
        );
        const sizeAfter = await Promise.all(
            entries.map(e => fs.promises.stat(e).then(r => r.size)),
        ).then(r => r.reduce((a, c) => a + c, 0));
        console.log(
            'Archiving emoticon',
            emoticon.emoticonId,
            'Optimized PNG',
            entries.length,
            'files from',
            sizeBefore,
            'to',
            sizeAfter,
            `(${((sizeAfter / sizeBefore - 1) * 100).toFixed(2)}%)`,
        );
    }
    const optimizeEnd = performance.now();
    console.log(
        'Optimized in',
        (optimizeEnd - optimizeStart) / 1000,
        'seconds',
    );

    // 打包为 ZIP 压缩包
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
    const archivePath = `${archiveDir}.zip`;
    await archive.writeZipPromise(archivePath);
    await fs.promises.rm(archiveDir, { recursive: true });
    const archiveSize = await fs.promises.stat(archivePath).then(r => r.size);
    console.log(
        'Archiving emoticon',
        emoticon.emoticonId,
        'Saved archive in',
        archivePath,
        'Size:',
        archiveSize,
    );

    emoticon.animated = emoticonImages.some(e => e.animated);
    emoticon.archiveUrl = archivePath;
    emoticon.archiveSize = archiveSize;

    return [emoticon, emoticonImages];
};
