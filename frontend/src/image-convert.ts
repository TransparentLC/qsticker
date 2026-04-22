export const blob2image = (blob: Blob) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            resolve(img);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
    });

export const buffer2image = (buffer: ArrayBuffer) =>
    blob2image(new Blob([buffer]));

export const raw2blob = async (raw: ImageData) => {
    const canvas = new OffscreenCanvas(raw.width, raw.height);
    // biome-ignore lint/style/noNonNullAssertion: explanation
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(raw, 0, 0);
    return await canvas.convertToBlob();
};

export const raw2buffer = async (raw: ImageData) =>
    raw2blob(raw).then(e => e.arrayBuffer());

export const raw2image = async (raw: ImageData) =>
    raw2blob(raw).then(blob2image);
