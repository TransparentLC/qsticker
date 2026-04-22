class RawImage {
    width: number;
    height: number;
    data: Uint8Array;

    static fromImage(image: HTMLImageElement) {
        const { width, height } = image;
        const canvas = new OffscreenCanvas(width, height);
        // biome-ignore lint/style/noNonNullAssertion: no reason
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        return new RawImage(
            width,
            height,
            new Uint8Array(ctx.getImageData(0, 0, width, height).data),
        );
    }

    constructor(
        width: number,
        height: number,
        data: Uint8Array = new Uint8Array(width * height * 4),
    ) {
        this.width = width;
        this.height = height;
        this.data = data;
    }

    pixelCount() {
        return this.width * this.height;
    }

    getImageCrop(
        x: number,
        y: number,
        image: RawImage,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
    ) {
        const width = x2 - x1;
        for (let j = 0; j < y2 - y1; j++) {
            const destIndex = (y + j) * this.width * 4 + x * 4;
            const srcIndex = (y1 + j) * image.width * 4 + x1 * 4;
            this.data.set(
                image.data.subarray(srcIndex, srcIndex + width * 4),
                destIndex,
            );
        }
    }

    padToTileSize(tileSize: number) {
        let newWidth = this.width;
        let newHeight = this.height;
        if (this.width < tileSize) {
            newWidth = tileSize;
        }
        if (this.height < tileSize) {
            newHeight = tileSize;
        }
        if (newWidth === this.width && newHeight === this.height) {
            return;
        }
        const newData = new Uint8Array(newWidth * newHeight * 4);
        for (let y = 0; y < this.height; y++) {
            const srcStart = y * this.width * 4;
            const destStart = y * newWidth * 4;
            newData.set(
                this.data.subarray(srcStart, srcStart + this.width * 4),
                destStart,
            );
        }
        if (newWidth > this.width) {
            const rightColumnIndex = (this.width - 1) * 4;
            for (let y = 0; y < this.height; y++) {
                const destRowStart = y * newWidth * 4;
                const srcPixelIndex = y * this.width * 4 + rightColumnIndex;
                const padPixel = this.data.subarray(
                    srcPixelIndex,
                    srcPixelIndex + 4,
                );
                for (let x = this.width; x < newWidth; x++) {
                    const destPixelIndex = destRowStart + x * 4;
                    newData.set(padPixel, destPixelIndex);
                }
            }
        }
        if (newHeight > this.height) {
            const bottomRowStart = (this.height - 1) * newWidth * 4;
            const bottomRow = newData.subarray(
                bottomRowStart,
                bottomRowStart + newWidth * 4,
            );
            for (let y = this.height; y < newHeight; y++) {
                const destRowStart = y * newWidth * 4;
                newData.set(bottomRow, destRowStart);
            }
        }
        this.width = newWidth;
        this.height = newHeight;
        this.data = newData;
    }

    cropToOriginalSize(width: number, height: number) {
        const newData = new Uint8Array(width * height * 4);
        for (let y = 0; y < height; y++) {
            const srcStart = y * this.width * 4;
            const destStart = y * width * 4;
            newData.set(
                this.data.subarray(srcStart, srcStart + width * 4),
                destStart,
            );
        }
        this.width = width;
        this.height = height;
        this.data = newData;
    }

    checkAlpha() {
        const pixelCount = this.pixelCount();
        for (let i = 0; i < pixelCount; i++) {
            if (this.data[i * 4 + 3] !== 255) return true;
        }
        return false;
    }

    copyAlpha(dest: RawImage) {
        const pixelCount = this.pixelCount();
        if (this.width !== dest.width || this.height !== dest.height) {
            throw new Error('RawImage size mismatch');
        }
        for (let i = 0; i < pixelCount; i++) {
            dest.data[i * 4 + 3] = this.data[i * 4 + 3];
        }
        return dest;
    }

    copyAlphaToRGB(dest: RawImage) {
        const pixelCount = this.pixelCount();
        if (this.width !== dest.width || this.height !== dest.height) {
            throw new Error('RawImage size mismatch');
        }
        for (let i = 0; i < pixelCount; i++) {
            const alpha = this.data[i * 4 + 3];
            dest.data[i * 4 + 0] = alpha;
            dest.data[i * 4 + 1] = alpha;
            dest.data[i * 4 + 2] = alpha;
            dest.data[i * 4 + 3] = alpha;
        }
        return dest;
    }

    async toBlob(config?: ImageEncodeOptions) {
        const { width, height, data } = this;
        const canvas = new OffscreenCanvas(width, height);
        // biome-ignore lint/style/noNonNullAssertion: no reason
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.createImageData(width, height);
        imageData.data.set(data);
        ctx.putImageData(imageData, 0, 0);
        return await canvas.convertToBlob(config);
    }

    async toImage(config?: ImageEncodeOptions) {
        const blob = await this.toBlob(config);
        return await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
        });
    }
}

export default RawImage;
