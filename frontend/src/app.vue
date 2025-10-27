<template>
    <n-config-provider
        :locale="zhCN"
        :date-locale="dateZhCN"
        :theme="theme"
        :theme-overrides="themeOverrides"
    >
        <n-space vertical size="large">
            <n-layout position="absolute">
                <n-layout-header style="padding:12px;display:flex;align-items:center" bordered>
                    <span style="font-size:16px">Qsticker Archive</span>
                    <div style="flex-grow:1"></div>
                    <n-flex size="small">
                        <n-button quaternary circle @click="showAbout">
                            <template #icon><n-mdi :icon="mdiInformationOutline"></n-mdi></template>
                        </n-button>
                        <n-button quaternary circle @click="copyLink">
                            <template #icon><n-mdi :icon="mdiShare"></n-mdi></template>
                        </n-button>
                    </n-flex>
                </n-layout-header>
                <n-layout has-sider position="absolute" style="top:64px">
                    <router-view v-slot="{ Component, route }">
                        <n-layout-content>
                            <div style="margin:0 auto;padding:12px;max-width:640px">
                                <keep-alive>
                                    <component v-if="route.meta.keepAlive" :is="Component" :key="route.fullPath"></component>
                                </keep-alive>
                                <component v-if="!route.meta.keepAlive" :is="Component"></component>
                            </div>
                        </n-layout-content>
                    </router-view>
                </n-layout>
            </n-layout>
        </n-space>
    </n-config-provider>
</template>

<script setup lang="tsx">
import { mdiInformationOutline, mdiShare } from '@mdi/js';
import {
    type ConfigProviderProps,
    createDiscreteApi,
    darkTheme,
    dateZhCN,
    type GlobalThemeOverrides,
    lightTheme,
    useOsTheme,
    zhCN,
} from 'naive-ui';
import { computed, onMounted } from 'vue';
import NMdi from './components/mdi.vue';

const osTheme = useOsTheme();
const theme = computed(() =>
    osTheme.value === 'light' ? lightTheme : darkTheme,
);

const themeOverrides: GlobalThemeOverrides = {
    common: {
        fontFamilyMono:
            'v-mono, SFMono-Regular, Menlo, "Cascadia Code", Consolas, Courier, monospace',
        fontWeightStrong: 'bold',
        primaryColor: '#0cf',
        primaryColorHover: '#1df',
        primaryColorPressed: '#0be',
        primaryColorSuppl: '#1df',
    },
};
const configProviderPropsRef = computed<ConfigProviderProps>(() => ({
    theme: theme.value,
    themeOverrides,
    locale: zhCN,
    dateLocale: dateZhCN,
}));

// @ts-expect-error 稍后添加额外的dialog相关方法
window.chiya = createDiscreteApi(['dialog'], {
    configProviderProps: configProviderPropsRef,
});
window.chiya.dialog.alert = options =>
    new Promise((resolve, reject) =>
        window.chiya.dialog.create({
            positiveText: '确认',
            onPositiveClick: () => resolve(),
            onMaskClick: reject,
            ...options,
        }),
    );
window.chiya.dialog.confirm = options =>
    new Promise(resolve =>
        window.chiya.dialog.create({
            positiveText: '确定',
            negativeText: '取消',
            onPositiveClick: () => resolve(true),
            onNegativeClick: () => resolve(false),
            onMaskClick: () => resolve(null),
            ...options,
        }),
    );
// window.chiya.dialog.prompt = options => {
//     let v = options.defaultValue || '';
//     return new Promise(resolve =>
//         window.chiya.dialog.create({
//             content: () => (
//                 <n-input
//                     defaultValue={options.defaultValue}
//                     placeholder={options.placeholder}
//                     onInput={(e: string) => {
//                         v = e;
//                     }}
//                 ></n-input>
//             ),
//             positiveText: '确定',
//             negativeText: '取消',
//             onPositiveClick: () => resolve(v),
//             onNegativeClick: () => resolve(null),
//             onMaskClick: () => resolve(null),
//             ...options,
//         }),
//     );
// };

const showAbout = () =>
    window.chiya.dialog.create({
        title: '关于本站和使用帮助',
        content: () => (
            <>
                <n-p>这是一个 QQ 表情包的镜像站。</n-p>
                <n-p>
                    主要功能是将 QQ 的
                    <n-a
                        href="https://zb.vip.qq.com/hybrid/emoticonmall/home"
                        target="_blank"
                    >
                        表情商城
                    </n-a>
                    的表情包直接保存为 PNG/GIF
                    文件（可以长按保存），或将整个表情包保存为 ZIP 文件，方便在
                    QQ 以外的地方使用。
                </n-p>
                <n-p>
                    由于获取表情包的原作者信息需要使用 QQ
                    登录，因此在这里无法获取和展示这部分内容，请使用 QQ
                    打开对应的表情商城页面查看。本站只提供表情包下载，请自行确认使用授权。
                </n-p>
                <n-p>
                    为了节省存储空间和带宽，打包下载的表情包使用{' '}
                    <n-a
                        href="https://github.com/oxipng/oxipng"
                        target="_blank"
                    >
                        Oxipng
                    </n-a>{' '}
                    和{' '}
                    <n-a href="http://www.lcdf.org/gifsicle/" target="_blank">
                        Gifsicle
                    </n-a>{' '}
                    进行了压缩。
                </n-p>
                <n-p>
                    静态表情包为 PNG 格式，在 QQ
                    中发送时会被视为图片，如果需要作为表情包发送则需要转换为 GIF
                    格式。你可以选择在打包下载的同时将所有表情在线转换为
                    GIF。对于单张表情包，也可以使用{' '}
                    <n-a href="https://ezgif.com/maker" target="_blank">
                        ezgif
                    </n-a>{' '}
                    或其他在线工具，或在本地使用{' '}
                    <n-a href="https://imagemagick.org/" target="_blank">
                        ImageMagick
                    </n-a>{' '}
                    等工具转换：
                    <n-code>
                        magick xxx.png -dither FloydSteinberg xxx.gif
                    </n-code>
                </n-p>
                <n-p>
                    源代码：
                    <n-a
                        href="https://github.com/TransparentLC/qsticker"
                        target="_blank"
                    >
                        https://github.com/TransparentLC/qsticker
                    </n-a>
                </n-p>
                <n-p>
                    API 文档：
                    <n-a href="docs" target="_blank">
                        点此查看
                    </n-a>{' '}
                    <n-a href="openapi.json" target="_blank">
                        <n-code>openapi.json</n-code>
                    </n-a>
                </n-p>
            </>
        ),
    });

const copyLink = () =>
    navigator.clipboard
        .writeText(location.href)
        .then(() => alert(`已复制到剪贴板：\n${location.href}`));

onMounted(() => {
    if (navigator.userAgent.match(/\bQQ\/(?:\d+\.){3}\d+\b/)) {
        window.chiya.dialog.alert({
            title: '提示',
            content: () => (
                <>
                    <n-p>
                        你正在使用手机 QQ
                        打开本站，可以通过长按保存的方式保存单张表情包，但是可能无法使用本站的打包下载功能。
                    </n-p>
                    <n-p>
                        如果需要打包下载表情包，请在浏览器中打开本站，或直接从
                        QQ 的
                        <n-a
                            href="https://zb.vip.qq.com/hybrid/emoticonmall/home"
                            target="_blank"
                        >
                            表情商城
                        </n-a>
                        下载。
                    </n-p>
                </>
            ),
        });
    }
});
</script>