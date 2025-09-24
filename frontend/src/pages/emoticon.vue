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
                        <n-button-group>
                            <n-button
                                type="primary"
                                tag="a"
                                :href="archiveUrl"
                                :download="`${route.params.emoticonId} - ${name}`"
                            ><template #icon><n-mdi :icon="mdiDownload"></n-mdi></template>下载</n-button>
                             <n-dropdown
                                v-if="!animated"
                                trigger="click"
                                :options="[
                                    { label: '下载并转换为 GIF', key: 'gif', icon: () => h(NMdi, { icon: mdiFileGifBox }) },
                                ]"
                                @select="downloadAlternative"
                            >
                                <n-button
                                    type="primary"
                                    secondary
                                    style="width:0"
                                ><template #icon><n-mdi :icon="mdiTriangleSmallDown"></n-mdi></template></n-button>
                             </n-dropdown>
                        </n-button-group>
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
import { mdiDownload, mdiFileGifBox, mdiTriangleSmallDown } from '@mdi/js';
import type { Unzipped } from 'fflate';
import { h, onMounted, ref, shallowRef, watch } from 'vue';
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

const downloadAlternative = async (format: string) => {
    switch (format) {
        case 'gif': {
            const [{ unzip, zip }, GIF, GIFWorker] = await Promise.all([
                import('fflate').then(({ unzip, zip }) => ({ unzip, zip })),
                import('gif.js').then(e => e.default),
                import('gif.js/dist/gif.worker.js?raw').then(e => e.default),
            ]);
            const archive = await fetch(archiveUrl.value)
                .then(r => r.arrayBuffer())
                .then(r => new Uint8Array(r));
            const unzipped = await new Promise<Unzipped>((resolve, reject) =>
                unzip(archive, (err, data) =>
                    err ? reject(err) : resolve(data),
                ),
            );
            const workerScript = URL.createObjectURL(new Blob([GIFWorker]));
            await Promise.all(
                Object.entries(unzipped)
                    .filter(([path, _]) =>
                        path.match(/\/emoticon\/.*?\.png$/gi),
                    )
                    .map(async ([path, data]) => {
                        const image = await new Promise<HTMLImageElement>(
                            (resolve, reject) => {
                                const image = new Image();
                                image.onload = () => {
                                    URL.revokeObjectURL(image.src);
                                    resolve(image);
                                };
                                image.onerror = reject;
                                image.src = URL.createObjectURL(
                                    new Blob([data.buffer as ArrayBuffer]),
                                );
                            },
                        );
                        unzipped[path.replace(/\.png$/g, '.gif')] =
                            await new Promise<Uint8Array>(resolve => {
                                const gif = new GIF({
                                    workerScript,
                                    quality: 5,
                                    dither: 'FloydSteinberg',
                                    transparent: 'rgba(0,0,0,0)',
                                });
                                gif.on('finished', blob =>
                                    blob
                                        .arrayBuffer()
                                        .then(r => resolve(new Uint8Array(r))),
                                );
                                gif.addFrame(image);
                                gif.render();
                            });
                        delete unzipped[path];
                    }),
            );
            URL.revokeObjectURL(workerScript);
            const repacked = await new Promise<Blob>((resolve, reject) =>
                zip(unzipped, { level: 9 }, (err, data) =>
                    err
                        ? reject(err)
                        : resolve(
                              new Blob([data.buffer as ArrayBuffer], {
                                  type: 'application/zip',
                              }),
                          ),
                ),
            );
            const el = document.createElement('a');
            el.href = URL.createObjectURL(repacked);
            el.download = `${route.params.emoticonId} - ${name.value}`;
            el.click();
            URL.revokeObjectURL(el.href);
        }
    }
};
</script>
