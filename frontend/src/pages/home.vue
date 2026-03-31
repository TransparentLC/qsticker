<template>
    <n-tabs
        v-model:value="tab"
        type="bar"
        justify-content="space-evenly"
        animated
    >
        <n-tab-pane name="emoticon" tab="表情包">
            <n-flex vertical :size="12">
                <n-input
                    v-model:value="keywordEmoticon"
                    :placeholder="`搜索表情包名称${description ? '和简介' : ''}`"
                    clearable
                >
                    <template #prefix><n-mdi :icon="mdiMagnify"></n-mdi></template>
                    <template #suffix>
                        <n-switch
                            v-model:value="description"
                            :round="false"
                            style="margin-left:calc(var(--n-padding-right) / 2)"
                            :rail-style="() => ({ backgroundColor: 'var(--n-rail-color)' })"
                        >
                            <template #unchecked-icon><n-mdi :icon="mdiTagSearch"></n-mdi></template>
                            <template #checked-icon><n-mdi :icon="mdiTextSearch"></n-mdi></template>
                        </n-switch>
                    </template>
                </n-input>
                <n-list
                    style="background-color:transparent"
                    :show-divider="false"
                    clickable
                    hoverable
                >
                    <template v-if="loadingEmoticon">
                        <n-list-item v-for="_ in 3">
                            <template #prefix>
                                <n-skeleton :width="64" :height="64" :sharp="false"></n-skeleton>
                            </template>
                            <template #suffix>
                            <n-skeleton :width="64" :height="34" round></n-skeleton>
                            </template>
                            <n-skeleton style="width:5em" :height="24" round></n-skeleton>
                            <div style="height:.5em"></div>
                            <n-skeleton style="width:10em" text></n-skeleton>
                        </n-list-item>
                    </template>
                    <template v-else>
                        <n-list-item v-for="e in emoticons" @click="router.push(`/emoticon/${e.emoticonId}`)">
                            <template #prefix>
                                <n-image
                                    :src="e.icon"
                                    width="64"
                                    height="64"
                                    lazy
                                    preview-disabled
                                    :img-props="{ referrerpolicy: 'no-referrer' }"
                                ></n-image>
                            </template>
                            <template #suffix>
                                <n-button
                                    type="primary"
                                    tertiary
                                    round
                                    @click.stop
                                    tag="a"
                                    :href="e.archiveUrl"
                                    :download="`${e.emoticonId} - ${e.name}`"
                                    :title="formatSize(e.archiveSize)"
                                >下载</n-button>
                            </template>
                            <n-thing
                                :description="e.description"
                                description-style="font-size:smaller;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2"
                            >
                                <template #header>
                                    <n-flex align="center" size="small">
                                        {{ e.name }}
                                        <n-tag
                                            v-if="e.animated"
                                            size="small"
                                            style="font-weight:normal"
                                        >GIF</n-tag>
                                        <n-tag
                                            v-if="reactiveWindowSize.width.value >= 420 && now.getTime() - e.updateTime.getTime() < 86400000"
                                            type="success"
                                            size="small"
                                            style="font-weight:normal"
                                        >{{ timeDiff(e.updateTime) }}更新</n-tag>
                                    </n-flex>
                                </template>
                            </n-thing>
                        </n-list-item>
                    </template>
                </n-list>
                <n-pagination
                    v-model:page="pageEmoticons"
                    :page-count="pageCountEmoticons"
                    :page-slot="9"
                    :simple="reactiveWindowSize.width.value < 600"
                    show-quick-jumper
                    style="justify-content:center"
                ></n-pagination>
            </n-flex>
        </n-tab-pane>

        <n-tab-pane name="emoticon-image" tab="单个表情">
            <n-flex vertical :size="12">
                <n-input
                    v-model:value="keywordEmoticonImage"
                    placeholder="搜索表情关键词"
                    clearable
                >
                    <template #prefix><n-mdi :icon="mdiMagnify"></n-mdi></template>
                </n-input>
                <n-flex v-if="showEmoticonImagePlaceholder" vertical align="center" style="margin:2em">
                    <n-mdi :icon="mdiTagSearch" size="72" depth="4"></n-mdi>
                    <n-text depth="3" style="margin-top:1em">请输入关键词进行搜索</n-text>
                </n-flex>
                <template v-else>
                    <n-grid x-gap="12" y-gap="12" cols="4">
                        <template v-if="loadingEmoticonImage">
                            <n-gi v-for="_ in 8">
                                <n-card size="small" hoverable content-style="padding:0">
                                    <n-flex vertical :size="0">
                                        <n-skeleton width="100%" height="auto" style="aspect-ratio:1"></n-skeleton>
                                        <div style="text-align:center;padding:.5em">
                                            <n-skeleton text repeat="2" style="width:60%"></n-skeleton>
                                        </div>
                                    </n-flex>
                                </n-card>
                            </n-gi>
                        </template>
                        <template v-else>
                            <n-gi v-for="e in emoticonImages">
                                <n-card size="small" hoverable content-style="padding:0">
                                    <n-flex vertical :size="0">
                                        <n-image
                                            width="100%"
                                            :show-toolbar="false"
                                            :preview-src="e.url"
                                            :src="e.preview"
                                            :alt="e.keyword"
                                            :img-props="{ referrerpolicy: 'no-referrer' }"
                                            :preview-img-props="{ referrerpolicy: 'no-referrer' }"
                                        ></n-image>
                                        <div style="text-align:center;padding:.5em">
                                            <n-text
                                                tag="div"
                                                style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                                                :title="e.keyword"
                                            >{{ e.keyword }}</n-text>
                                            <router-link
                                                v-slot="{ navigate, href }"
                                                :to="`/emoticon/${e.emoticon.emoticonId}`"
                                                custom
                                            >
                                                <n-a
                                                    :href="href"
                                                    @click="navigate"
                                                    style="display:block;font-size:smaller;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                                                    depth="3"
                                                    :underline="false"
                                                    :title="e.emoticon.name"
                                                >{{ e.emoticon.name }}</n-a>
                                            </router-link>
                                        </div>
                                    </n-flex>
                                </n-card>
                            </n-gi>
                        </template>
                    </n-grid>
                    <n-pagination
                        v-model:page="pageEmoticonImages"
                        :page-count="pageCountEmoticonImages"
                        :page-slot="9"
                        :simple="reactiveWindowSize.width.value < 600"
                        show-quick-jumper
                        style="justify-content:center"
                    ></n-pagination>
                </template>
            </n-flex>
        </n-tab-pane>
    </n-tabs>
</template>

<script setup lang="ts">
import { mdiMagnify, mdiTagSearch, mdiTextSearch } from '@mdi/js';
import { throttle } from 'throttle-debounce';
import { onMounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import wretch from 'wretch';
import wretchQueryString from 'wretch/addons/queryString';
import NMdi from '../components/mdi.vue';
import formatSize from '../format-size';
import reactiveWindowSize from '../reactive-display';

const router = useRouter();
const tab = ref<'emoticon' | 'emoticon-image'>('emoticon');

const loadingEmoticon = ref(false);
const keywordEmoticon = ref('');
const description = ref(false);
const emoticons = shallowRef<
    {
        emoticonId: number;
        name: string;
        description: string;
        icon: string;
        updateTime: Date;
        source: EmoticonSource;
        archiveUrl: string;
        archiveSize: number;
        animated: boolean;
    }[]
>([]);
const pageEmoticons = ref(1);
const pageCountEmoticons = ref(0);

const loadingEmoticonImage = ref(false);
const showEmoticonImagePlaceholder = ref(true);
const keywordEmoticonImage = ref('');
const emoticonImages = shallowRef<
    {
        emoticonImageId: number;
        keyword: string;
        url: string;
        preview: string;
        animated: Date;
        emoticon: {
            emoticonId: number;
            name: string;
            updateTime: Date;
            source: EmoticonSource;
        };
    }[]
>([]);
const pageEmoticonImages = ref(1);
const pageCountEmoticonImages = ref(0);

const now = ref(new Date());
setInterval(() => (now.value = new Date()), 1000);
const timeDiff = (t: Date) => {
    let diff = Math.abs(t.getTime() - now.value.getTime());
    const beforeOrAfter = t < now.value ? '前' : '后';
    if (diff < 60000) {
        return `${Math.floor(diff / 1000)} 秒${beforeOrAfter}`;
    } else if (diff < 3600000) {
        return `${Math.floor(diff / 60000)} 分钟${beforeOrAfter}`;
    } else if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)} 小时${beforeOrAfter}`;
    } else {
        return `${Math.floor(diff / 86400000)} 天${beforeOrAfter}`;
    }
};

const searchEmoticons = async (resetPage: boolean = false) => {
    loadingEmoticon.value = true;
    const r = await wretch('api/emoticon')
        .addon(wretchQueryString)
        .query({
            ...(keywordEmoticon.value
                ? { keyword: keywordEmoticon.value }
                : {}),
            description: description.value,
            page: pageEmoticons.value,
        })
        .get()
        .json<{
            count: number;
            pages: number;
            result: {
                emoticonId: number;
                name: string;
                description: string;
                icon: string;
                updateTime: string;
                source: EmoticonSource;
                archiveUrl: string;
                archiveSize: number;
                animated: boolean;
            }[];
        }>();
    if (resetPage) pageEmoticons.value = 1;
    emoticons.value = r.result.map(e => ({
        ...e,
        updateTime: new Date(e.updateTime),
    }));
    pageCountEmoticons.value = r.pages;
    loadingEmoticon.value = false;
};

const searchEmoticonImages = async (resetPage: boolean = false) => {
    if (!keywordEmoticonImage.value) {
        pageEmoticonImages.value = 1;
        pageCountEmoticonImages.value = 0;
        emoticonImages.value = [];
        return;
    }
    loadingEmoticonImage.value = true;
    showEmoticonImagePlaceholder.value = false;
    const r = await wretch('api/emoticon-image')
        .addon(wretchQueryString)
        .query({
            keyword: keywordEmoticonImage.value,
            page: pageEmoticonImages.value,
        })
        .get()
        .json<{
            count: number;
            pages: number;
            result: {
                emoticonImageId: number;
                keyword: string;
                url: string;
                preview: string;
                animated: Date;
                emoticon: {
                    emoticonId: number;
                    name: string;
                    updateTime: Date;
                    source: EmoticonSource;
                };
            }[];
        }>();
    if (resetPage) pageEmoticonImages.value = 1;
    emoticonImages.value = r.result.map(e => {
        e.emoticon.updateTime = new Date(e.emoticon.updateTime);
        return e;
    });
    pageCountEmoticonImages.value = r.pages;
    loadingEmoticonImage.value = false;
};

onMounted(searchEmoticons);
watch(
    [keywordEmoticon, description],
    throttle(
        500,
        (
            [keywordEmoticonBefore, descriptionBefore],
            [keywordEmoticonAfter, descriptionAfter],
        ) => {
            if (
                keywordEmoticonBefore === keywordEmoticonAfter &&
                !keywordEmoticon.value &&
                descriptionBefore !== descriptionAfter
            )
                return;
            searchEmoticons(true);
        },
        { noLeading: true },
    ),
);
watch(
    keywordEmoticonImage,
    throttle(500, () => searchEmoticonImages(true), { noLeading: true }),
);
watch(keywordEmoticonImage, () => {
    if (!keywordEmoticonImage.value) showEmoticonImagePlaceholder.value = true;
});
watch(pageEmoticons, () => searchEmoticons());
watch(pageEmoticonImages, () => searchEmoticonImages());
</script>
