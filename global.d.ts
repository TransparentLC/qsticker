import type { HttpBindings } from '@hono/node-server';

declare global {
    namespace SQLiteZSTD {
        // https://github.com/phiresky/sqlite-zstd/blob/3a820f34f326a2d177292071af42104d2634316c/src/transparent.rs#L44
        type TransparentCompressConfig = {
            table: string;
            column: string;
            // biome-ignore format: 1-19，格式化的话会很长
            compression_level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19,
            dict_chooser: string | "'[nodict]'";
            min_dict_size_bytes_for_training?: number;
            dict_size_ratio?: number;
            train_dict_samples_ratio?: number;
            incremental_compression_step_bytes?: number;
        };
    }

    type HonoSchema = {
        Bindings: HttpBindings;
    };

    // https://gxh.vip.qq.com/qqshow/admindata/comdata/vipEmoji_item_203291/xydata.json
    type EmoticonMetadata = {
        appData: {
            name: string;
        };
        timestamp: number;
        data: {
            baseInfo: [
                {
                    name: string;
                    tag: string;
                    desc: string;
                },
            ];
            md5Info: {
                name: string;
                md5: string;
            }[];
        };
    };
}
