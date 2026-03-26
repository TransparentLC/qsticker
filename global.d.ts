import type { HttpBindings } from '@hono/node-server';

declare global {
    type HonoSchema = {
        Bindings: HttpBindings;
    };

    type EmoticonSource = 'qq' | 'bilibili';

    namespace EmoticonMetadata {
        // https://i.gtimg.cn/club/item/parcel/9/245759_android.json
        type QQ = {
            name: string;
            mark: string;
            updateTime: number;
            imgs: {
                id: string;
                name: string;
            }[];
        };

        // https://api.bilibili.com/x/garb/v2/user/suit/benefit?part=cards&item_id=1733737624001
        // https://api.bilibili.com/x/garb/v2/user/suit/benefit?part=cards&item_id=1743559818001
        type Bilibili = {
            name: string;
            /** 格式：https://www.bilibili.com/h5/mall/digital-card/home?-Abrowser=live&act_id=104978&hybrid_set_header=2 */
            buy_link: string;
            properties: {
                image: string;
                /** 实际上是 { name: string; image_webp?: string, image_gif?: string, image: string } 的 JSON 字符串 */
                item_emoji_list: string;
                /** 0 是静态表情，1 是动态表情 */
                resource_type: '0' | '1';
            };
        };
        // https://api.bilibili.com/x/garb/v2/user/suit/benefit?part=cards&item_id=75613
        type BilibiliLegacy = {
            name: string;
            /** 格式：https://www.bilibili.com/h5/mall/digital-card/home?-Abrowser=live&act_id=104978&hybrid_set_header=2 */
            buy_link: string;
            properties: {
                image: string;
                item_ids: string;
            };
            suit_items: {
                emoji: {
                    /** 格式为 [表情包名称_表情关键词] */
                    name: string;
                    /** 动态表情没有 image_webp 和 image_gif */
                    properties: {
                        image_webp?: string;
                        image_gif?: string;
                        image: string;
                    };
                }[];
            };
        };
    }

    namespace EmoticonExtra {
        type Bilibili = {
            actId: number;
        };
    }

    // https://api.bilibili.com/x/vas/dlc_act/asset_bag?act_id=104978
    // https://api.bilibili.com/x/vas/dlc_act/asset_bag?act_id=111348
    // 个别收藏集没有表情包，例如：
    // https://api.bilibili.com/x/vas/dlc_act/asset_bag?act_id=191
    // 个别收藏集有多个卡池，每个卡池一个表情包，不过这里还是会包含所有的表情包，例如：
    // https://api.bilibili.com/x/vas/dlc_act/asset_bag?act_id=100171
    type BilibiliActAssetBag = {
        collect_list:
            | {
                  collect_id: number;
                  start_time: number;
                  end_time: number;
                  /** 2 是静态表情包，15 是动态表情包 */
                  redeem_item_type: number;
                  redeem_item_id: string;
                  redeem_item_name: string;
              }[]
            | null;
    };
    // https://api.bilibili.com/x/vas/dlc_act/act/basic?act_id=111348
    type BilibiliActBasic = {
        product_introduce: string;
    };
}
