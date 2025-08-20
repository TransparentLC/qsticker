import { createRouter, createWebHashHistory } from 'vue-router';

export default createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: '/',
            component: () =>
                import(/* vitePrefetch: true */ './pages/home.vue'),
            meta: {
                keepAlive: true,
            },
        },
        {
            path: '/emoticon/:emoticonId(\\d+)',
            component: () =>
                import(/* vitePrefetch: true */ './pages/emoticon.vue'),
        },
        {
            path: '/:path(.*)*',
            redirect: '/',
        },
    ],
});
