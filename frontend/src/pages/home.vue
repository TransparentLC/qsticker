<template>
    <n-flex vertical :size="12">
        <n-input
            v-model:value="keyword"
            placeholder="搜索表情包"
            clearable
        >
            <template #prefix><n-mdi :icon="mdiMagnify "></n-mdi></template>
        </n-input>
        <n-list
            style="background-color:transparent"
            :show-divider="false"
            clickable
            hoverable
        >
            <template v-if="loading">
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
                        description-style="font-size:smaller"
                    >
                        <template #header>
                            <n-flex align="center" size="small">
                                {{ e.name }}
                                <n-tag
                                    v-if="e.animated"
                                    size="small"
                                    style="font-weight:normal"
                                >GIF</n-tag>
                            </n-flex>
                        </template>
                    </n-thing>
                </n-list-item>
            </template>
        </n-list>
        <n-pagination
            v-model:page="page"
            :page-count="pageCount"
            :page-slot="9"
            :simple="reactiveWindowSize.width.value < 600"
            show-quick-jumper
            style="justify-content:center"
        ></n-pagination>
    </n-flex>
</template>

<script setup lang="ts">
import { mdiMagnify } from '@mdi/js';
import { throttle } from 'throttle-debounce';
import { onMounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import wretch from 'wretch';
import wretchQueryString from 'wretch/addons/queryString';
import NMdi from '../components/mdi.vue';
import formatSize from '../format-size';
import reactiveWindowSize from '../reactive-display';

const router = useRouter();
const loading = ref(false);

const keyword = ref('');
const emoticons = shallowRef<
    {
        emoticonId: number;
        name: string;
        description: string;
        icon: string;
        archiveUrl: string;
        archiveSize: number;
        animated: boolean;
    }[]
>([]);
const page = ref(1);
const pageCount = ref(0);

const updateEmoticons = async (resetPage: boolean = false) => {
    loading.value = true;
    const r = await wretch('api/emoticon')
        .addon(wretchQueryString)
        .query({
            ...(keyword.value ? { keyword: keyword.value } : {}),
            page: page.value,
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
                archiveUrl: string;
                archiveSize: number;
                animated: boolean;
            }[];
        }>();
    if (resetPage) page.value = 1;
    emoticons.value = r.result;
    pageCount.value = r.pages;
    loading.value = false;
};

onMounted(updateEmoticons);
watch(
    keyword,
    throttle(500, () => updateEmoticons(true), { noLeading: true }),
);
watch(page, () => updateEmoticons());
</script>
