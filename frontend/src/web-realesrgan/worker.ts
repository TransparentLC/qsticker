/// <reference lib="webworker" />

import * as tf from '@tensorflow/tfjs';
import RawImage from './raw-image';

export type MessageToWorker = {
    taskId: number;
    input: ArrayBuffer;
    type: 'realesrgan' | 'realcugan';
    model: string;
    factor: 2 | 4;
    tileSize: number;
    overlap: number;
    width: number;
    height: number;
};
export type MessageFromWorker = { taskId: number } & (
    | {
          type: 'error';
          message: string;
      }
    | {
          type: 'progress';
          progress: number;
          message?: string;
      }
    | {
          type: 'done';
          output: ArrayBuffer;
      }
);

const initBackend = (async () => {
    if (navigator.gpu) {
        await import('@tensorflow/tfjs-backend-webgpu');
    }
    await tf.setBackend(navigator.gpu ? 'webgpu' : 'webgl');
})();

const modelCache = new Map<string, tf.GraphModel>();
const loadModel = async (modelUrl: string) => {
    if (!modelCache.has(modelUrl)) {
        modelCache.set(modelUrl, await tf.loadGraphModel(modelUrl));
    }
    // biome-ignore lint/style/noNonNullAssertion: no reason
    return modelCache.get(modelUrl)!;
};

const upscale = async (image: RawImage, model: tf.GraphModel) => {
    const result = tf.tidy(() => model.predict(img2tensor(image)) as tf.Tensor);
    const resultImage = await tensor2img(result);
    tf.dispose(result);
    return resultImage;
};

const img2tensor = (image: RawImage) => {
    const imgdata = new ImageData(image.width, image.height);
    imgdata.data.set(image.data);
    return tf.browser.fromPixels(imgdata).div(255).toFloat().expandDims();
};

const tensor2img = async (tensor: tf.Tensor) => {
    const [_, height, width, __] = tensor.shape;
    const clipped = tf.tidy(() =>
        tensor
            .reshape([height, width, 3])
            .mul(255)
            .cast('int32')
            .clipByValue(0, 255),
    );
    tensor.dispose();
    const data = (await tf.browser.toPixels(
        clipped as tf.Tensor3D,
    )) as unknown as Uint8Array;
    clipped.dispose();
    return new RawImage(width, height, data);
};

addEventListener('message', async (e: MessageEvent<MessageToWorker>) => {
    await initBackend;

    const { data } = e;
    const taskId = data.taskId;

    postMessage({
        taskId,
        type: 'progress',
        progress: 0,
        message: 'Loading model...',
    } as MessageFromWorker);
    let modelUrl: string;
    if (data.type === 'realesrgan') {
        modelUrl = `/upscale-models/realesrgan/${data.model}-${data.tileSize}/model.json`;
    } else if (data.type === 'realcugan') {
        modelUrl = `/upscale-models/realcugan/${data.factor}x-${data.model}-${data.tileSize}/model.json`;
    } else {
        postMessage({
            taskId,
            type: 'error',
            message: `Unknown model ${data.type}.`,
        } as MessageFromWorker);
        return;
    }
    const model = await loadModel(modelUrl);
    const input = new RawImage(
        data.width,
        data.height,
        new Uint8Array(data.input),
    );
    const originalWidth = input.width;
    const originalHeight = input.height;
    input.padToTileSize(data.tileSize);
    const withPadding =
        input.width !== originalWidth || input.height !== originalHeight;
    async function enlargeImageWithFixedInput(
        model: tf.GraphModel,
        inputImg: RawImage,
        factor: number,
        inputSize: number,
        overlap: number,
    ) {
        const width = inputImg.width;
        const height = inputImg.height;
        const output = new RawImage(width * factor, height * factor);
        const num_x = Math.max(
            2,
            Math.ceil((width - overlap) / (inputSize - overlap)),
        );
        const num_y = Math.max(
            2,
            Math.ceil((height - overlap) / (inputSize - overlap)),
        );
        const locs_x = new Array(num_x);
        const locs_y = new Array(num_y);
        const pad_left = new Array(num_x);
        const pad_top = new Array(num_y);
        const pad_right = new Array(num_x);
        const pad_bottom = new Array(num_y);
        const total_lap_x = inputSize * num_x - width;
        const total_lap_y = inputSize * num_y - height;
        const base_lap_x = Math.floor(total_lap_x / (num_x - 1));
        const base_lap_y = Math.floor(total_lap_y / (num_y - 1));
        const extra_lap_x = total_lap_x - base_lap_x * (num_x - 1);
        const extra_lap_y = total_lap_y - base_lap_y * (num_y - 1);
        locs_x[0] = 0;
        for (let i = 1; i < num_x; i++) {
            if (i <= extra_lap_x) {
                locs_x[i] = locs_x[i - 1] + inputSize - base_lap_x - 1;
            } else {
                locs_x[i] = locs_x[i - 1] + inputSize - base_lap_x;
            }
        }
        locs_y[0] = 0;
        for (let i = 1; i < num_y; i++) {
            if (i <= extra_lap_y) {
                locs_y[i] = locs_y[i - 1] + inputSize - base_lap_y - 1;
            } else {
                locs_y[i] = locs_y[i - 1] + inputSize - base_lap_y;
            }
        }
        pad_left[0] = 0;
        pad_top[0] = 0;
        pad_right[num_x - 1] = 0;
        pad_bottom[num_y - 1] = 0;
        for (let i = 1; i < num_x; i++) {
            pad_left[i] = Math.floor(
                (locs_x[i - 1] + inputSize - locs_x[i]) / 2,
            );
        }
        for (let i = 1; i < num_y; i++) {
            pad_top[i] = Math.floor(
                (locs_y[i - 1] + inputSize - locs_y[i]) / 2,
            );
        }
        for (let i = 0; i < num_x - 1; i++) {
            pad_right[i] =
                locs_x[i] + inputSize - locs_x[i + 1] - pad_left[i + 1];
        }
        for (let i = 0; i < num_y - 1; i++) {
            pad_bottom[i] =
                locs_y[i] + inputSize - locs_y[i + 1] - pad_top[i + 1];
        }

        postMessage({
            taskId,
            type: 'progress',
            progress: 0,
            message: 'Image prepared and start upscaling.',
        } as MessageFromWorker);

        const total = num_x * num_y;
        let current = 0;
        for (let i = 0; i < num_x; i++) {
            for (let j = 0; j < num_y; j++) {
                const x1 = locs_x[i];
                const y1 = locs_y[j];
                const x2 = locs_x[i] + inputSize;
                const y2 = locs_y[j] + inputSize;
                const tile = new RawImage(inputSize, inputSize);
                tile.getImageCrop(0, 0, inputImg, x1, y1, x2, y2);
                const scaled = await upscale(tile, model);
                output.getImageCrop(
                    (x1 + pad_left[i]) * factor,
                    (y1 + pad_top[j]) * factor,
                    scaled,
                    pad_left[i] * factor,
                    pad_top[j] * factor,
                    scaled.width - pad_right[i] * factor,
                    scaled.height - pad_bottom[j] * factor,
                );
                current++;
                postMessage({
                    type: 'progress',
                    progress: current / total,
                } as MessageFromWorker);
            }
        }
        return output;
    }
    const { factor, tileSize, overlap } = data;
    let output: RawImage;
    try {
        output = await enlargeImageWithFixedInput(
            model,
            input,
            factor,
            tileSize,
            overlap,
        );
    } catch (e) {
        postMessage({
            taskId,
            type: 'error',
            message: (e as Error).toString(),
        } as MessageFromWorker);
        return;
    }
    if (withPadding) {
        output.cropToOriginalSize(
            originalWidth * factor,
            originalHeight * factor,
        );
    }

    postMessage({
        taskId,
        type: 'progress',
        progress: 1,
    } as MessageFromWorker);
    postMessage(
        {
            taskId,
            type: 'done',
            output: output.data.buffer,
        } as MessageFromWorker,
        [output.data.buffer],
    );
});
