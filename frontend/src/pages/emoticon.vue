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
                :img-props="{ referrerpolicy: 'no-referrer' }"
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
                             <n-popover trigger="click" placement="bottom">
                                <template #trigger>
                                    <n-button
                                        type="primary"
                                        secondary
                                        style="width:0"
                                    ><template #icon><n-mdi :icon="mdiTriangleSmallDown"></n-mdi></template></n-button>
                                </template>
                                <n-grid :x-gap="12" :y-gap="8" :cols="2" style="align-items:center;grid-template-columns:auto 150px">
                                    <n-grid-item span="2" style="font-size:large">
                                        <strong>AI 放大</strong>
                                    </n-grid-item>
                                    <n-grid-item style="text-align:right">静态 PNG 图片</n-grid-item>
                                    <n-grid-item>
                                        <n-select
                                            v-model:value="upscalePNGMode"
                                            placeholder="不放大"
                                            :options="[
                                                { label: '不放大', value: null },
                                                { label: 'Real-CUGAN 2x', value: 'realcugan,no-denoise,2' },
                                                { label: 'Real-CUGAN 4x', value: 'realcugan,no-denoise,4' },
                                                { label: 'Real-ESRGAN 4x', value: 'realesrgan,anime-plus,4' },
                                            ]"
                                        ></n-select>
                                    </n-grid-item>
                                    <n-grid-item style="text-align:right">动态 GIF 图片</n-grid-item>
                                    <n-grid-item>
                                        <n-select
                                            v-model:value="upscaleGIFMode"
                                            placeholder="不放大"
                                            :options="[
                                                { label: '不放大', value: null },
                                                { label: 'Real-CUGAN 2x', value: 'realcugan,no-denoise,2' },
                                                { label: 'Real-CUGAN 4x', value: 'realcugan,no-denoise,4' },
                                                { label: 'Real-ESRGAN 4x', value: 'realesrgan,anime-plus,4' },
                                            ]"
                                        ></n-select>
                                    </n-grid-item>
                                    <n-grid-item span="2" style="font-size:large">
                                        <strong>格式转换</strong>
                                    </n-grid-item>
                                    <n-grid-item style="text-align:right">静态 PNG 图片</n-grid-item>
                                    <n-grid-item>
                                        <n-select
                                            v-model:value="convertPNGMode"
                                            placeholder="不转换"
                                            :options="[
                                                { label: '不转换', value: null },
                                                { label: 'GIF', value: 'gif' },
                                                { label: '无损 WebP', value: 'webp-lossless' },
                                                { label: '有损 WebP', value: 'webp-lossy' },
                                            ]"
                                        ></n-select>
                                    </n-grid-item>
                                    <n-grid-item style="text-align:right">动态 GIF 图片</n-grid-item>
                                    <n-grid-item>
                                        <n-select
                                            v-model:value="convertGIFMode"
                                            placeholder="不转换"
                                            :options="[
                                                { label: '不转换', value: null },
                                                { label: '有损 WebP', value: 'webp-lossy' },
                                            ]"
                                        ></n-select>
                                    </n-grid-item>
                                    <n-grid-item span="2">
                                        <n-button
                                            type="primary"
                                            secondary
                                            block
                                            @click="convertDownload(upscalePNGMode, upscaleGIFMode, convertPNGMode, convertGIFMode)"
                                            :loading="convertLoading"
                                        >
                                            <template #icon><n-mdi :icon="mdiDownload"></n-mdi></template>
                                            <template v-if="convertLoading">
                                                转换中……&nbsp;<span v-if="convertProgressTotal">({{ convertProgressCurrent }}/{{ convertProgressTotal }})</span>
                                            </template>
                                            <template v-else>下载并转换</template>
                                        </n-button>
                                    </n-grid-item>
                                </n-grid>
                             </n-popover>
                        </n-button-group>
                        <n-button
                            v-if="source === 'qq'"
                            secondary
                            tag="a"
                            :href="`https://zb.vip.qq.com/hybrid/emoticonmall/detail?id=${route.params.emoticonId}`"
                            target="_blank"
                        >表情商城</n-button>
                        <n-button
                            v-if="source === 'bilibili'"
                            secondary
                            tag="a"
                            :href="`https://www.bilibili.com/h5/mall/digital-card/home?navhide=1&hybrid_set_header=2&act_id=${extra!.actId}`"
                            target="_blank"
                        >查看收藏集</n-button>
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
                            :preview-src="e.url"
                            :src="e.preview"
                            :alt="e.keyword"
                            :img-props="{ referrerpolicy: 'no-referrer' }"
                            :previewed-img-props="{ referrerpolicy: 'no-referrer' }"
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

<script setup lang="tsx">
import { mdiDownload, mdiTriangleSmallDown } from '@mdi/js';
import type { Unzipped } from 'fflate';
import type { UnencodedFrame } from 'modern-gif';
import { onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import wretch from 'wretch';
import NMdi from '../components/mdi.vue';
import formatSize from '../format-size';
import { buffer2image, raw2buffer, raw2image } from '../image-convert';

const route = useRoute();
const router = useRouter();
const loading = ref(false);

const name = ref('');
const description = ref('');
const icon = ref('');
const updateTime = ref(new Date());
const source = ref('');
const archiveUrl = ref('');
const archiveSize = ref(0);
const animated = ref(false);
const images = shallowRef<
    {
        keyword: string;
        url: string;
        preview: string;
        animated: boolean;
    }[]
>([]);
// biome-ignore lint/suspicious/noExplicitAny: explanation
const extra = ref<any>(null);

const update = async () => {
    loading.value = true;
    const r = await wretch(`api/emoticon/${route.params.emoticonId}`)
        .get()
        .json<{
            emoticonId: number;
            name: string;
            description: string;
            icon: string;
            updateTime: string;
            source: string;
            archiveUrl: string;
            archiveSize: number;
            animated: boolean;
            images: {
                keyword: string;
                url: string;
                preview: string;
                animated: boolean;
            }[];
            // biome-ignore lint/suspicious/noExplicitAny: explanation
            extra: any;
        }>();
    name.value = r.name;
    description.value = r.description;
    icon.value = r.icon;
    updateTime.value = new Date(r.updateTime);
    source.value = r.source;
    archiveUrl.value = r.archiveUrl;
    archiveSize.value = r.archiveSize;
    animated.value = r.animated;
    images.value = r.images;
    extra.value = r.extra;
    loading.value = false;
};

onMounted(update);
watch(() => route.params.emoticonId, update);

type ConvertMode = 'gif' | 'webp-lossless' | 'webp-lossy' | null;
type UpscaleMode = string | null;

const convertPNGMode = ref<ConvertMode>(null);
const convertGIFMode = ref<ConvertMode>(null);
const upscalePNGMode = ref<UpscaleMode>(null);
const upscaleGIFMode = ref<UpscaleMode>(null);
const convertLoading = ref(false);
const convertProgressCurrent = ref(0);
const convertProgressTotal = ref(0);

const convertDownload = async (
    pngUpscale: UpscaleMode,
    gifUpscale: UpscaleMode,
    pngMode: ConvertMode,
    gifMode: ConvertMode,
) => {
    if (pngUpscale || gifUpscale) {
        if (
            !(await window.chiya.dialog.confirm({
                title: '提示',
                content: () => (
                    <>
                        <n-p>
                            AI 放大功能需要加载 2-10 MB
                            左右的模型，且耗时较长，不建议在移动端执行。根据 GPU
                            性能和图片大小不同，在桌面端放大一张静态图片需要
                            2-10s，
                            <n-text strong>
                                对于动图则需要逐帧放大，耗时极长
                            </n-text>
                            。
                        </n-p>
                        {navigator.gpu ? (
                            ''
                        ) : (
                            <n-p>
                                你的浏览器不支持或未启用
                                WebGPU，耗时将会更长。可以在{' '}
                                <n-a
                                    href="https://caniuse.com/webgpu"
                                    target="_blank"
                                >
                                    Can I use ...
                                </n-a>{' '}
                                上查看你的浏览器是否支持和如何启用。
                            </n-p>
                        )}
                        <n-p>
                            此功能仅作为前端技术展示，如果对速度有较高要求，建议在电脑上使用{' '}
                            <n-a
                                href="https://github.com/TransparentLC/realesrgan-gui"
                                target="_blank"
                            >
                                Real-ESRGAN GUI
                            </n-a>{' '}
                            等软件进行 AI 放大。
                        </n-p>
                        <n-p>是否继续？</n-p>
                    </>
                ),
            }))
        )
            return;
    }
    if (pngMode?.includes('webp') || gifMode?.includes('webp')) {
        if (
            !(await window.chiya.dialog.confirm({
                title: '提示',
                content:
                    '转换为 WebP 需要较长时间，转换完成前请耐心等待。是否继续？',
            }))
        )
            return;
    }

    const pngUpscaleConfig = pngUpscale
        ? (() => {
              const [type, model, factor] = pngUpscale.split(',');
              return { type, model, factor: parseInt(factor, 10) };
          })()
        : null;
    const gifUpscaleConfig = gifUpscale
        ? (() => {
              const [type, model, factor] = gifUpscale.split(',');
              return { type, model, factor: parseInt(factor, 10) };
          })()
        : null;

    try {
        convertLoading.value = true;

        const { unzip, zip } = await import('fflate');
        const archive = await fetch(archiveUrl.value)
            .then(r => r.arrayBuffer())
            .then(r => new Uint8Array(r));
        const unzipped = await new Promise<Unzipped>((resolve, reject) =>
            unzip(archive, (err, data) => (err ? reject(err) : resolve(data))),
        );
        const unzippedEntries = Object.entries(unzipped);

        convertProgressCurrent.value = 0;
        convertProgressTotal.value = unzippedEntries.length;
        const converted: Unzipped = {};
        for (const [path, data] of unzippedEntries) {
            convertProgressCurrent.value++;
            if (path.match(/\/emoticon\/.*?\.png$/gi)) {
                const dataUpscaled = pngUpscaleConfig
                    ? await (async () => {
                          const upscale = await import(
                              '../web-realesrgan'
                          ).then(e => e.default);
                          const image = await buffer2image(
                              data.buffer as ArrayBuffer,
                          );
                          // @ts-expect-error
                          return upscale(image, {
                              ...pngUpscaleConfig,
                              timeLabel: path,
                          })
                              .then(e => e.toBlob())
                              .then(e => e.arrayBuffer())
                              .then(e => new Uint8Array(e));
                      })()
                    : data;
                switch (pngMode) {
                    case 'gif': {
                        const gifEncode = await import('modern-gif').then(
                            e => e.encode,
                        );
                        const image = await buffer2image(
                            dataUpscaled.buffer as ArrayBuffer,
                        );
                        converted[path.replace(/\.png$/g, '.gif')] =
                            await gifEncode({
                                width: image.width,
                                height: image.height,
                                frames: [{ data: image }],
                                dither: 'floyd-steinberg',
                                ditherTransparency: 'stucki',
                            }).then(r => new Uint8Array(r));
                        break;
                    }
                    case 'webp-lossless':
                    case 'webp-lossy': {
                        const img2webp = await import('../img2webp').then(
                            e => e.default,
                        );
                        converted[path.replace(/\.png$/g, '.webp')] =
                            await img2webp({
                                minSize: true,
                                sharpYUV: true,
                                frames: [
                                    {
                                        frame: dataUpscaled.buffer as ArrayBuffer,
                                        lossless: pngMode === 'webp-lossless',
                                        quality: 80,
                                        compression: 4,
                                    },
                                ],
                            }).then(e => new Uint8Array(e));
                        break;
                    }
                    default:
                        converted[path] = dataUpscaled;
                }
            } else if (path.match(/\/emoticon\/.*?\.gif$/gi)) {
                const framesUpscaled = gifUpscaleConfig
                    ? await (async () => {
                          const [upscale, gifDecodeFrames] = await Promise.all([
                              import('../web-realesrgan').then(e => e.default),
                              import('modern-gif').then(e => e.decodeFrames),
                          ]);
                          const frames = gifDecodeFrames(
                              data.buffer as ArrayBuffer,
                          );
                          const framesUpscaled = [] as (Omit<
                              UnencodedFrame,
                              'data'
                          > & { data: ArrayBuffer })[];
                          for (const frame of frames) {
                              const image = await raw2image(
                                  new ImageData(
                                      frame.data as Uint8ClampedArray<ArrayBuffer>,
                                      frame.width,
                                      frame.height,
                                  ),
                              );
                              // @ts-expect-error
                              const frameUpscaled = await upscale(image, {
                                  ...gifUpscaleConfig,
                                  timeLabel: path,
                              });
                              framesUpscaled.push({
                                  data: await frameUpscaled
                                      .toBlob()
                                      .then(e => e.arrayBuffer()),
                                  width: frameUpscaled.width,
                                  height: frameUpscaled.height,
                                  delay: frame.delay,
                              });
                          }
                          return framesUpscaled;
                      })()
                    : await (async () => {
                          const gifDecodeFrames = await import(
                              'modern-gif'
                          ).then(e => e.decodeFrames);
                          const frames = [] as (Omit<UnencodedFrame, 'data'> & {
                              data: ArrayBuffer;
                          })[];
                          for (const frame of gifDecodeFrames(
                              data.buffer as ArrayBuffer,
                          )) {
                              frames.push({
                                  data: await raw2buffer(
                                      new ImageData(
                                          frame.data as Uint8ClampedArray<ArrayBuffer>,
                                          frame.width,
                                          frame.height,
                                      ),
                                  ),
                                  width: frame.width,
                                  height: frame.height,
                                  delay: frame.delay,
                              });
                          }
                          return frames;
                      })();
                switch (gifMode) {
                    case 'webp-lossy': {
                        const img2webp = await import('../img2webp').then(
                            e => e.default,
                        );
                        converted[path.replace(/\.gif$/g, '.webp')] =
                            await img2webp({
                                minSize: true,
                                sharpYUV: true,
                                frames: framesUpscaled.map(e => ({
                                    frame: e.data,
                                    // biome-ignore lint/style/noNonNullAssertion: explanation
                                    delay: e.delay! * 10,
                                    quality: 80,
                                    compression: 4,
                                })),
                            }).then(e => new Uint8Array(e));

                        break;
                    }
                    default:
                        converted[path] = framesUpscaled
                            ? await (async () => {
                                  const gifEncode = await import(
                                      'modern-gif'
                                  ).then(e => e.encode);
                                  return await gifEncode({
                                      width:
                                          // biome-ignore lint/style/noNonNullAssertion: explanation
                                          framesUpscaled[0]!.width!,
                                      height:
                                          // biome-ignore lint/style/noNonNullAssertion: explanation
                                          framesUpscaled[0]!.height!,
                                      frames: framesUpscaled,
                                      dither: 'floyd-steinberg',
                                      ditherTransparency: 'stucki',
                                  }).then(e => new Uint8Array(e));
                              })()
                            : data;
                }
            } else {
                converted[path] = data;
            }
        }

        const repacked = await new Promise<Blob>((resolve, reject) =>
            zip(converted, { level: 9 }, (err, data) =>
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
    } catch (err) {
        console.error(err);
        window.chiya.dialog.error({
            title: '转换失败',
            content: (err as Error).toString(),
        });
    } finally {
        convertProgressTotal.value = 0;
        convertLoading.value = false;
    }
};
</script>
