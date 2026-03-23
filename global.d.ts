import type { HttpBindings } from '@hono/node-server';

declare global {
    type HonoSchema = {
        Bindings: HttpBindings;
    };

    // https://i.gtimg.cn/club/item/parcel/9/245759_android.json
    type EmoticonMetadata = {
        name: string;
        mark: string;
        updateTime: number;
        imgs: {
            id: string;
            name: string;
        }[];
    };
}
