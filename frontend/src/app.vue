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

<script setup lang="ts">
import { mdiInformationOutline, mdiShare } from '@mdi/js';
import {
    type ConfigProviderProps,
    createDiscreteApi,
    darkTheme,
    dateZhCN,
    type GlobalThemeOverrides,
    lightTheme,
    NA,
    NCode,
    NInput,
    NP,
    useOsTheme,
    zhCN,
} from 'naive-ui';
import { computed, h } from 'vue';
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
window.chiya.dialog.prompt = options => {
    let v = options.defaultValue || '';
    return new Promise(resolve =>
        window.chiya.dialog.create({
            content: () =>
                h(NInput, {
                    defaultValue: options.defaultValue,
                    placeholder: options.placeholder,
                    onInput(e) {
                        v = e;
                    },
                }),
            positiveText: '确定',
            negativeText: '取消',
            onPositiveClick: () => resolve(v),
            onNegativeClick: () => resolve(null),
            onMaskClick: () => resolve(null),
            ...options,
        }),
    );
};

const showAbout = () =>
    window.chiya.dialog.create({
        title: '关于本站和使用帮助',
        content: () => [
            h(NP, () => '这是一个 QQ 表情包的镜像站。'),
            h(NP, () => [
                '主要功能是将 QQ 的',
                h(
                    NA,
                    {
                        href: 'https://zb.vip.qq.com/hybrid/emoticonmall/home',
                        target: '_blank',
                    },
                    () => '表情商城',
                ),
                '的表情包直接保存为 PNG/GIF 文件（可以长按保存），或将整个表情包保存为 ZIP 文件，方便在 QQ 以外的地方使用。',
            ]),
            h(
                NP,
                () =>
                    '由于获取表情包的原作者信息需要使用 QQ 登录，因此在这里无法获取和展示这部分内容，请使用 QQ 打开对应的表情商城页面查看。本站只提供表情包下载，请自行确认使用授权。',
            ),
            h(NP, () => [
                '为了节省存储空间和带宽，打包下载的表情包使用 ',
                h(
                    NA,
                    {
                        href: 'https://github.com/oxipng/oxipng',
                        target: '_blank',
                    },
                    () => 'Oxipng',
                ),
                ' 和 ',
                h(
                    NA,
                    {
                        href: 'http://www.lcdf.org/gifsicle/',
                        target: '_blank',
                    },
                    () => 'Gifsicle',
                ),
                ' 进行了压缩。',
            ]),
            h(NP, () => [
                '如果有需要的话，可以使用 ',
                h(
                    NA,
                    {
                        href: 'https://ezgif.com/maker',
                        target: '_blank',
                    },
                    () => 'ezgif',
                ),
                ' 或其他在线工具将 PNG 格式的表情转换为 GIF 格式。',
            ]),
            h(NP, () => [
                '源代码：',
                h(
                    NA,
                    {
                        href: 'https://github.com/TransparentLC/qsticker',
                        target: '_blank',
                    },
                    () => 'https://github.com/TransparentLC/qsticker',
                ),
            ]),
            h(NP, () => [
                'API 文档：',
                h(
                    NA,
                    {
                        href: 'docs',
                        target: '_blank',
                    },
                    () => '点此查看',
                ),
                ' ',
                h(
                    NA,
                    {
                        href: 'openapi.json',
                        target: '_blank',
                    },
                    () => h(NCode, () => 'openapi.json'),
                ),
            ]),
        ],
    });

const copyLink = () =>
    navigator.clipboard
        .writeText(location.href)
        .then(() => alert(`已复制到剪贴板：\n${location.href}`));
</script>