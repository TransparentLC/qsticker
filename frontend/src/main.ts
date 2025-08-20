import { NA, NP } from 'naive-ui';
import { createApp, h } from 'vue';
import app from './app.vue';
import router from './router';

createApp(app).use(router).mount('#app');

const consoleBadge = (label: string, content: string, color: string) =>
    console.log(
        `%c ${label} %c ${content} `,
        'color:#fff;background-color:#555;border-radius:3px 0 0 3px',
        `color:#fff;background-color:${color};border-radius:0 3px 3px 0`,
    );

consoleBadge('Project', 'qsticker', '#07c');
consoleBadge('Author', 'TransparentLC', '#f84');
// @ts-expect-error
consoleBadge('Build Time', __BUILD_TIME__, '#f48');
// @ts-expect-error
consoleBadge('Build With', `${__VUE_VERSION__} + ${__VITE_VERSION__}`, '#4b8');

if (navigator.userAgent.match(/\bQQ\/(?:\d+\.){3}\d+\b/)) {
    window.chiya.dialog.alert({
        title: '提示',
        content: () => [
            h(
                NP,
                () =>
                    '你正在使用手机 QQ 打开本站，可以通过长按保存的方式保存单张表情包，但是可能无法使用本站的打包下载功能。',
            ),
            h(NP, () => [
                '如果需要打包下载表情包，请在浏览器中打开本站，或直接从 QQ 的',
                h(
                    NA,
                    {
                        href: 'https://zb.vip.qq.com/hybrid/emoticonmall/home',
                        target: '_blank',
                    },
                    '表情商城',
                ),
                '下载。',
            ]),
        ],
    });
}
