import { shallowRef } from 'vue';

// 基本上是照抄这个：
// https://vuetifyjs.com/zh-Hans/features/display-and-platform/

const width = shallowRef(Infinity);
const height = shallowRef(Infinity);

const update = () => {
    width.value = window.innerWidth;
    height.value = window.innerHeight;
};

update();
addEventListener('resize', update, { passive: true });

export default Object.freeze({ width, height });
