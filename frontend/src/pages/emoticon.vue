<template>
    <n-flex vertical :size="12">
        <n-flex :wrap="false">
            <n-skeleton v-if="loading" :width="96" :height="96" :sharp="false"></n-skeleton>
            <n-image
                v-else
                :src="icon"
                width="96"
                height="96"
                preview-disabled
            ></n-image>
            <n-flex vertical>
                <template v-if="loading">
                    <n-skeleton style="width:5em" :height="24" round></n-skeleton>
                    <n-skeleton style="width:5em" text></n-skeleton>
                </template>
                <template v-else>
                    <n-thing
                        :description="formatSize(archiveSize)"
                        style="flex-grow:1"
                        description-style="font-size:smaller"
                    >
                        <template #header>
                            <n-flex align="center" size="small">
                                {{ name }}
                                <n-tag
                                    v-if="animated"
                                    size="small"
                                    style="font-weight:normal"
                                >GIF</n-tag>
                            </n-flex>
                        </template>
                    </n-thing>
                    <n-flex>
                        <n-button
                            type="primary"
                            tag="a"
                            :href="archiveUrl"
                            :download="`${route.params.emoticonId} - ${name}`"
                        ><template #icon><n-mdi :icon="mdiDownload"></n-mdi></template>下载</n-button>
                        <n-button
                            secondary
                            tag="a"
                            :href="`https://zb.vip.qq.com/hybrid/emoticonmall/detail?id=${route.params.emoticonId}`"
                            target="_blank"
                        >表情商城</n-button>
                    </n-flex>
                </template>
            </n-flex>
        </n-flex>
        <template v-if="loading">
            <n-skeleton text :repeat="1"></n-skeleton>
            <n-skeleton text style="width:60%"></n-skeleton>
        </template>
        <n-text v-else>{{ description }}</n-text>
        <n-grid v-if="!loading" x-gap="12" :cols="4">
            <n-gi v-for="e in images">
                <n-tooltip trigger="hover">
                    <template #trigger>
                        <n-image
                            width="100%"
                            :show-toolbar="false"
                            :preview-src="e.src"
                            :src="e.preview"
                            :alt="e.keyword"
                        ></n-image>
                    </template>
                    {{ e.keyword }}
                </n-tooltip>
            </n-gi>
        </n-grid>
        <n-button
            tertiary
            block
            @click="router.push('/')"
        >返回</n-button>
    </n-flex>
</template>

<script setup lang="ts">
import { mdiDownload } from '@mdi/js';
import { onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import wretch from 'wretch';
import NMdi from '../components/mdi.vue';
import formatSize from '../format-size';

const route = useRoute();
const router = useRouter();
const loading = ref(false);

const name = ref('');
const description = ref('');
const icon = ref('');
const archiveUrl = ref('');
const archiveSize = ref(0);
const animated = ref(false);
const images = shallowRef<
    {
        keyword: string;
        src: string;
        preview: string;
    }[]
>([]);

const update = async () => {
    loading.value = true;
    const r = await wretch(`api/emoticon/${route.params.emoticonId}`)
        .get()
        .json<{
            emoticonId: number;
            name: string;
            description: string;
            icon: string;
            archiveUrl: string;
            archiveSize: number;
            animated: boolean;
            images: {
                keyword: string;
                src: string;
                preview: string;
            }[];
        }>();
    name.value = r.name;
    description.value = r.description;
    icon.value = r.icon;
    archiveUrl.value = r.archiveUrl;
    archiveSize.value = r.archiveSize;
    animated.value = r.animated;
    images.value = r.images;
    loading.value = false;
};

onMounted(update);
watch(() => route.params.emoticonId, update);
</script>
