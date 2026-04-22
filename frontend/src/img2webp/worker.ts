/// <reference lib="webworker" />

import {
    getFileWithBlobData,
    Img2Webp,
    initFS,
    initLocateFile,
    runImg2Webp,
    writeFileWithUint8ArrayData,
    // @ts-expect-error
} from '@libwebp-wasm/img2webp';
import wasmModuleUrl from '@libwebp-wasm/img2webp/lib/img2webp.wasm?url';

export type MessageToWorker = {
    taskId: number;
    frames: ArrayBuffer[];
    args: string[];
};
export type MessageFromWorker = { taskId: number } & (
    | {
          type: 'error';
          message: string;
      }
    | {
          type: 'done';
          output: ArrayBuffer;
      }
);

const initWasmInstance = Img2Webp(initLocateFile(wasmModuleUrl)).then(
    (e: unknown) => {
        initFS(e, '/img2webp');
        return e;
    },
) as Promise<unknown>;

addEventListener('message', async (e: MessageEvent<MessageToWorker>) => {
    const wasmInstance = await initWasmInstance;

    const { data } = e;
    const taskId = data.taskId;

    try {
        for (let i = 0; i < data.frames.length; i++) {
            writeFileWithUint8ArrayData(
                wasmInstance,
                `${taskId}-${i}`,
                data.frames[i],
            );
        }
        runImg2Webp(
            wasmInstance,
            '_main',
            ...data.args,
            '-o',
            `${taskId}.webp`,
        );
        const output = await (
            getFileWithBlobData(wasmInstance, `${taskId}.webp`) as Blob
        ).arrayBuffer();
        postMessage(
            {
                taskId,
                type: 'done',
                output,
            } as MessageFromWorker,
            [output],
        );
    } catch (e) {
        postMessage({
            taskId,
            type: 'error',
            message: (e as Error).toString(),
        } as MessageFromWorker);
    }
});
