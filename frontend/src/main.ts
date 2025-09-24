import { createApp } from 'vue';
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
consoleBadge('Commit', `${__COMMIT_HASH__} ${__COMMIT_TIME__}`, '#f48');
// @ts-expect-error
consoleBadge('Build With', `${__VUE_VERSION__} + ${__VITE_VERSION__}`, '#4b8');
consoleBadge('Source', 'https://github.com/TransparentLC/qsticker', '#000');
