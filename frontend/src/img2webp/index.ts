import type { MessageFromWorker, MessageToWorker } from './worker';

let taskIdCounter = 0;
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
});

export default async (
    config: Partial<{
        /** Minimize size */
        minSize: boolean;
        /** Maximum number of frame between key-frames (0 = only keyframes) */
        kmax: number;
        /** Minimum number of frame between key-frames (0 = disable key-frames altogether) */
        kmin: number;
        /** Use mixed lossy/lossless automatic mode */
        mixed: boolean;
        /** Use near-lossless image preprocessing (0...100 off, default: 100) */
        nearLossless: number;
        /** Use sharper (and slower) RGB -> YUV conversion (lossy only) */
        sharpYUV: boolean;
        /** Loop count (default: 0 infinite loop) */
        loop: number;
    }> & {
        frames: ({
            frame: ArrayBuffer;
        } & Partial<{
            /** Frame duration in ms (default: 100) */
            duration: number;
            /** Use lossless mode */
            lossless: boolean;
            /** Quality (0...100) */
            quality: number;
            /** Compression method (fast 0...6 slowest, default: 4) */
            compression: 0 | 1 | 2 | 3 | 4 | 5 | 6;
            /** Preserve RGB values in transparent area */
            exact: boolean;
        }>)[];
    },
) => {
    const taskId = taskIdCounter++;

    const args: string[] = [];
    if (config.minSize) args.push('-min_size');
    if (config.kmax) {
        args.push('-kmax');
        args.push(config.kmax.toString());
    }
    if (config.kmin) {
        args.push('-kmin');
        args.push(config.kmin.toString());
    }
    if (config.mixed) args.push('-mixed');
    if (config.nearLossless) {
        args.push('-near_lossless');
        args.push(config.nearLossless.toString());
    }
    if (config.sharpYUV) args.push('-sharp_yuv');
    if (config.loop) {
        args.push('-loop');
        args.push(config.loop.toString());
    }
    for (let i = 0; i < config.frames.length; i++) {
        const frame = config.frames[i];
        if (frame.duration) {
            args.push('-d');
            args.push(frame.duration.toString());
        }
        args.push(frame.lossless ? '-lossless' : '-lossy');
        if (frame.quality) {
            args.push('-q');
            args.push(frame.quality.toString());
        }
        if (frame.compression) {
            args.push('-m');
            args.push(frame.compression.toString());
        }
        args.push(frame.exact ? '-exact' : '-noexact');
        args.push(`${taskId}-${i}`);
    }

    const frames = config.frames.map(e => e.frame);

    return new Promise<ArrayBuffer>((resolve, reject) => {
        const handler = (e: MessageEvent<MessageFromWorker>) => {
            const data = e.data;
            if (data.taskId !== taskId) return;
            worker.removeEventListener('message', handler);
            if (data.type === 'error') {
                reject(data.message);
            } else if (data.type === 'done') {
                resolve(data.output);
            }
        };
        worker.addEventListener('message', handler);
        worker.postMessage(
            {
                taskId,
                frames,
                args,
            } as MessageToWorker,
            frames,
        );
    });
};
