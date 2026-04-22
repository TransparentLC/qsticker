# web-realesrgan

在浏览器中使用 Real-ESRGAN/Real-CUGAN 放大图片。

是 https://github.com/xororz/web-realesrgan 的独立版，把放大图片的部分分离成了单独的函数。

```ts
const upscale: (source: HTMLImageElement, config: ({
    type: "realesrgan";
    model: "anime-fast" | "anime-plus" | "general-fast" | "general-plus";
    factor: 4;
} | {
    type: "realcugan";
    model: "conservative" | "no-denoise" | "denoise3x";
    factor: 2 | 4;
}) & {
    tileSize?: 32 | 48 | 64 | 96 | 128 | 192 | 256; // 默认为 128
    overlap?: 0 | 4 | 8 | 12 | 16 | 20; // 默认为 12
    timeLabel?: string | undefined;
    onProgress?: ((progress: {
        type: "progress";
        progress: number;
        message?: string | undefined;
    }) => void) | undefined;
    onProgressAlpha?: ((progress: {
        type: "progress";
        progress: number;
        message?: string | undefined;
    }) => void) | undefined;
}) => Promise<RawImage>;

const upscaled = await upscale(source, { ... });
await upscaled.toBlob(); // Blob
await upscaled.toImage(); // HTMLImageElement
```

<details>

<summary>从本家下载模型</summary>

```py
import httpx
import itertools
import os
import orjson

s = httpx.Client(http2=True)
h = 'https://upscale.chino.icu/'

for model, tileSize in itertools.product(
    ('anime_fast', 'anime_plus', 'general_fast', 'general_plus'),
    (32, 48, 64, 96, 128, 192, 256),
):
    modelName = f'{model}-{tileSize}'
    modelDir = f'models/realesrgan/{modelName}/'
    os.makedirs(modelDir.replace('_', '-'), exist_ok=True)
    print(h + modelDir + 'model.json')
    r = s.get(h + modelDir + 'model.json')
    model = r.json()
    with open(os.path.join(modelDir.replace('_', '-'), 'model.json'), 'wb') as f:
        f.write(orjson.dumps(model))
    for weightsManifest in model['weightsManifest']:
        for path in weightsManifest['paths']:
            with (
                open(os.path.join(modelDir.replace('_', '-'), path), 'wb') as f,
                s.stream('GET', h + modelDir + path) as r,
            ):
                for d in r.iter_bytes():
                    f.write(d)

for factor, denoise, tileSize in itertools.product(
    (2, 4),
    ('conservative', 'no-denoise', 'denoise3x'),
    (32, 48, 64, 96, 128, 192, 256),
):
    modelName = f'{factor}x-{denoise}-{tileSize}'
    modelDir = f'models/realcugan/{modelName}/'
    os.makedirs(modelDir, exist_ok=True)
    print(h + modelDir + 'model.json')
    r = s.get(h + modelDir + 'model.json')
    model = r.json()
    with open(os.path.join(modelDir, 'model.json'), 'wb') as f:
        f.write(orjson.dumps(model))
    for weightsManifest in model['weightsManifest']:
        for path in weightsManifest['paths']:
            with (
                open(os.path.join(modelDir, path), 'wb') as f,
                s.stream('GET', h + modelDir + path) as r,
            ):
                for d in r.iter_bytes():
                    f.write(d)
```

</details>
