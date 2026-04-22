import RawImage from './raw-image';
import type { MessageFromWorker, MessageToWorker } from './worker';

let taskIdCounter = 0;
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
});
const workerAlpha = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
});

export default async (
    /** The image to be upscaled */
    source: HTMLImageElement,
    config: (
        | {
              /** Use Real-ESRGAN to upscale image */
              type: 'realesrgan';
              /**
               * * anime-fast:   RealESRGAN-animevideov3
               * * anime-plus:   RealESRGAN_x4plus_anime_6B
               * * general-fast: RealESRGAN-general-x4v3
               * * general-plus: RealESRGAN_x4plus
               */
              model:
                  | 'anime-fast'
                  | 'anime-plus'
                  | 'general-fast'
                  | 'general-plus';
              factor: 4;
          }
        | {
              /** Use Real-CUGAN to upscale image */
              type: 'realcugan';
              /**
               * * conservative: Tries to keep the original details intact and avoids over-smoothing.
               * * no-denoise:   No noise reduction is applied, so the original noise and details are preserved.
               * * denoise3x:    Strong noise reduction which will remove most or all of the noise, but it might also cause some loss of fine details, making the image smoother.
               */
              model: 'conservative' | 'no-denoise' | 'denoise3x';
              factor: 2 | 4;
          }
    ) & {
        /**
         * The image is not enlarged by the model as a whole; instead, it is split into tiles.
         * The model enlarges each tile sequentially, and then all the tiles are stitched together to form the entire image.
         *
         * * On WebGL, larger tile sizes can make your device appear to lag during execution. If your device becomes laggy, you can reduce the tile size.
         * * On WebGPU, larger tile sizes can speed up the entire process.
         * * The larger the tile size (if your GPU can handle it), the faster the overall computation. Otherwise, smaller slices would be faster.
         *
         * Default: 128
         */
        tileSize?: 32 | 48 | 64 | 96 | 128 | 192 | 256;
        /**
         * When the image is split into tiles, adjacent tiles need to have overlap.
         * Without overlap, the boundaries between two tiles can appear disconnected, resulting in a lack of smooth transitions.
         *
         * * You can set the overlap to 0 to observe this phenomenon.
         * * If you notice horizontal or vertical dividing lines after enlarging the image, you can increase the overlap to improve the seamlessness.
         *
         * Default: 12
         */
        overlap?: 0 | 4 | 8 | 12 | 16 | 20;
        /** Measure upscale time with `console.time` and `console.timeEnd`. */
        timeLabel?: string;
        onProgress?: (
            progress: Extract<MessageFromWorker, { type: 'progress' }>,
        ) => void;
        onProgressAlpha?: (
            progress: Extract<MessageFromWorker, { type: 'progress' }>,
        ) => void;
    },
) => {
    if (config.timeLabel) console.time(config.timeLabel);

    const taskId = taskIdCounter++;

    const launchWorker = (
        worker: Worker,
        image: RawImage,
        onProgress?: (
            progress: Extract<MessageFromWorker, { type: 'progress' }>,
        ) => void,
    ) =>
        new Promise<RawImage>((resolve, reject) => {
            const handler = (e: MessageEvent<MessageFromWorker>) => {
                const data = e.data;
                if (data.taskId !== taskId) return;
                if (data.type === 'progress') {
                    if (onProgress) onProgress(data);
                } else if (data.type === 'error') {
                    worker.removeEventListener('message', handler);
                    reject(data.message);
                } else if (data.type === 'done') {
                    worker.removeEventListener('message', handler);
                    resolve(
                        new RawImage(
                            image.width * config.factor,
                            image.height * config.factor,
                            new Uint8Array(data.output),
                        ),
                    );
                }
            };
            worker.addEventListener('message', handler);
            worker.postMessage(
                {
                    taskId,
                    input: image.data.buffer,
                    type: config.type,
                    model: config.model,
                    factor: config.factor,
                    tileSize: config.tileSize ?? 128,
                    overlap: config.overlap ?? 12,
                    width: image.width,
                    height: image.height,
                } as MessageToWorker,
                [image.data.buffer],
            );
        });
    const image = RawImage.fromImage(source);
    const imageAlpha = image.checkAlpha()
        ? image.copyAlphaToRGB(new RawImage(image.width, image.height))
        : null;
    const [imageUpscaled, imageAlphaUpscaled] = await Promise.all([
        launchWorker(worker, image, config.onProgress),
        imageAlpha
            ? launchWorker(workerAlpha, imageAlpha, config.onProgressAlpha)
            : null,
    ]);

    if (imageAlphaUpscaled) {
        const pixelCount = imageUpscaled.pixelCount();
        for (let i = 0; i < pixelCount; i++) {
            // LUT from Photoshop curve: (209, 182) (237, 245)
            // biome-ignore format: no reason
            imageUpscaled.data[i * 4 + 3] = [
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
                0x01, 0x01, 0x01, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x03, 0x03, 0x03, 0x03,
                0x03, 0x03, 0x03, 0x04, 0x04, 0x04, 0x04, 0x04, 0x05, 0x05, 0x05, 0x05, 0x05, 0x06, 0x06, 0x06,
                0x06, 0x07, 0x07, 0x07, 0x07, 0x08, 0x08, 0x08, 0x09, 0x09, 0x09, 0x0A, 0x0A, 0x0A, 0x0B, 0x0B,
                0x0C, 0x0C, 0x0C, 0x0D, 0x0D, 0x0E, 0x0E, 0x0F, 0x0F, 0x10, 0x10, 0x10, 0x11, 0x12, 0x12, 0x13,
                0x13, 0x14, 0x14, 0x15, 0x15, 0x16, 0x17, 0x17, 0x18, 0x19, 0x19, 0x1A, 0x1B, 0x1B, 0x1C, 0x1D,
                0x1E, 0x1E, 0x1F, 0x20, 0x21, 0x22, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x29, 0x2A,
                0x2B, 0x2C, 0x2D, 0x2E, 0x2F, 0x30, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3B, 0x3C,
                0x3D, 0x3E, 0x40, 0x41, 0x42, 0x43, 0x45, 0x46, 0x47, 0x49, 0x4A, 0x4C, 0x4D, 0x4F, 0x50, 0x51,
                0x53, 0x55, 0x56, 0x58, 0x59, 0x5B, 0x5C, 0x5E, 0x60, 0x61, 0x63, 0x65, 0x67, 0x68, 0x6A, 0x6C,
                0x6E, 0x70, 0x71, 0x73, 0x75, 0x77, 0x79, 0x7B, 0x7D, 0x7F, 0x81, 0x83, 0x85, 0x87, 0x89, 0x8C,
                0x8E, 0x90, 0x92, 0x94, 0x97, 0x99, 0x9B, 0x9D, 0xA0, 0xA2, 0xA5, 0xA7, 0xA9, 0xAC, 0xAE, 0xB1,
                0xB3, 0xB6, 0xB9, 0xBB, 0xBE, 0xC0, 0xC3, 0xC6, 0xC8, 0xCB, 0xCE, 0xD0, 0xD3, 0xD5, 0xD8, 0xDA,
                0xDC, 0xDF, 0xE1, 0xE3, 0xE5, 0xE8, 0xEA, 0xEB, 0xED, 0xEF, 0xF1, 0xF2, 0xF4, 0xF5, 0xF6, 0xF7,
                0xF8, 0xF9, 0xFA, 0xFB, 0xFB, 0xFC, 0xFC, 0xFD, 0xFD, 0xFE, 0xFE, 0xFE, 0xFE, 0xFF, 0xFF, 0xFF,
            ][Math.round(
                0.299 * imageAlphaUpscaled.data[i * 4 + 0] +
                    0.587 * imageAlphaUpscaled.data[i * 4 + 1] +
                    0.114 * imageAlphaUpscaled.data[i * 4 + 2],
            )];
        }
    }

    if (config.timeLabel) console.timeEnd(config.timeLabel);

    return imageUpscaled;
};
