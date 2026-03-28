import { Palette } from 'modern-palette';

interface Application {
    identifier: string;
    code: string;
    data: number[];
}
interface GraphicControl {
    delayTime: number;
    transparentIndex: number;
    reserved: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
    disposal: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
    userInput: boolean;
    transparent: boolean;
}
type Comment = string;
interface PlainText {
    left: number;
    top: number;
    width: number;
    height: number;
    cellWidth: number;
    cellHeight: number;
    colorIndex: number;
    backgroundColorIndex: number;
    data: number[];
}
interface Frame {
    left: number;
    top: number;
    width: number;
    height: number;
    localColorTable: boolean;
    interlaced: boolean;
    reserved: 0 | 1 | 2 | 3;
    colorTableSorted: boolean;
    colorTableSize: number;
    colorTable?: number[][];
    lzwMinCodeSize: number;
    dataPositions: number[][];
    application?: Application;
    graphicControl?: GraphicControl;
    comment?: Comment;
    plainText?: PlainText;
    index: number;
    delay: number;
    disposal: GraphicControl['disposal'];
}
type EncodingFrame = Partial<Frame> & {
    data: Uint8ClampedArray;
    transparent?: boolean;
};
type UnencodedFrame = Partial<Frame> & {
    data: CanvasImageSource | BufferSource | string;
};
interface Gif87a {
    width: number;
    height: number;
    globalColorTable: boolean;
    colorResoluTion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    colorTableSorted: boolean;
    colorTableSize: number;
    backgroundColorIndex: number;
    pixelAspectRatio: number;
    colorTable?: number[][];
    frames: Frame[];
}
interface Gif89a extends Gif87a {
    looped?: boolean;
    loopCount?: number;
}
interface Gif extends Gif89a {
    version: '89a' | '87a';
}
type DitherMethod = 'floyd-steinberg' | 'atkinson' | 'stucki';

declare function decode(source: BufferSource): Gif;

interface DecodedFrame {
    width: number;
    height: number;
    delay: number;
    data: Uint8ClampedArray;
}
interface DecodeFramesOptions {
    gif?: Gif;
    range?: number[];
}
interface DecodeFramesInWorkerOptions extends DecodeFramesOptions {
    workerUrl: string;
}
declare function decodeFrames(source: BufferSource, options: DecodeFramesInWorkerOptions): Promise<DecodedFrame[]>;
declare function decodeFrames(source: BufferSource, options?: DecodeFramesOptions): DecodedFrame[];

declare function decodeFrame(source: BufferSource, index: number, gif?: Gif): DecodedFrame;

interface DecodedUndisposedFrame {
    width: number;
    height: number;
    delay: number;
    data: Uint8ClampedArray;
}
declare function decodeUndisposedFrame(source: BufferSource, gif: Gif, index: number): DecodedUndisposedFrame;

interface EncoderOptions extends Partial<Omit<Gif, 'width' | 'height' | 'frames'>> {
    /** GIF width */
    width: number;
    /** GIF height */
    height: number;
    /** The frames that needs to be encoded */
    frames?: Array<UnencodedFrame>;
    /** Enable debug mode to view the execution time log */
    debug?: boolean;
    /** Worker script url */
    workerUrl?: string;
    /** Max colors count 2-255 */
    maxColors?: number;
    /** Palette premultipliedAlpha */
    premultipliedAlpha?: boolean;
    /** Palette tint */
    tint?: Array<number>;
    /** Specifies the dithering method to be used for colors */
    dither?: DitherMethod;
    /** Specifies the dithering method to be used for partially transparent pixels */
    ditherTransparency?: DitherMethod;
}

declare function encode(options: EncoderOptions & {
    format: 'blob';
}): Promise<Blob>;
declare function encode(options: EncoderOptions & {
    format?: 'arrayBuffer';
}): Promise<ArrayBuffer>;

interface WorkerOptions {
    workerUrl?: string;
    workerNumber?: number;
}
interface CreatedWorker {
    call: (type: string, data: any, transfer?: Transferable[], index?: number) => Promise<any>;
}
declare function createWorker(options: WorkerOptions): CreatedWorker;

declare class Logger {
    isDebug: boolean;
    static prefix: string;
    constructor(isDebug?: boolean);
    time(label: string): void;
    timeEnd(label: string): void;
    debug(...args: any[]): void;
    warn(...args: any[]): void;
}

interface EncoderConfig extends EncoderOptions {
    maxColors: number;
    premultipliedAlpha: boolean;
    tint: Array<number>;
    colorTableSize: number;
    backgroundColorIndex: number;
}
declare class Encoder {
    protected _logger: Logger;
    protected _palette: Palette;
    protected _config: EncoderConfig;
    protected _encodingFrames: Array<EncodingFrame>;
    protected _encodeUUID: number;
    protected _worker?: ReturnType<typeof createWorker>;
    constructor(options: EncoderOptions);
    protected _resolveOptions(options: EncoderOptions): EncoderConfig;
    encode(frame: UnencodedFrame): Promise<void>;
    flush(format: 'blob'): Promise<Blob>;
    flush(format?: 'arrayBuffer'): Promise<ArrayBuffer>;
}

export { type Application, type Comment, type DecodeFramesInWorkerOptions, type DecodeFramesOptions, type DecodedFrame, type DecodedUndisposedFrame, type DitherMethod, Encoder, type EncoderConfig, type EncoderOptions, type EncodingFrame, type Frame, type Gif, type Gif87a, type Gif89a, type GraphicControl, type PlainText, type UnencodedFrame, decode, decodeFrame, decodeFrames, decodeUndisposedFrame, encode };
