import { Finder, Palette } from 'modern-palette';

const SIGNATURE = "GIF";
const VERSIONS = ["87a", "89a"];
const IMAGE_DESCRIPTOR = 44;
const EXTENSION = 33;
const EXTENSION_APPLICATION = 255;
const EXTENSION_APPLICATION_BLOCK_SIZE = 11;
const EXTENSION_COMMENT = 254;
const EXTENSION_GRAPHIC_CONTROL = 249;
const EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE = 4;
const EXTENSION_PLAIN_TEXT = 1;
const EXTENSION_PLAIN_TEXT_BLOCK_SIZE = 1;
const TRAILER = 59;
function mergeBuffers(buffers) {
  const container = new Uint8Array(
    buffers.reduce((total, array) => total + array.byteLength, 0)
  );
  buffers.reduce((offset, array) => {
    container.set(array, offset);
    return offset + array.byteLength;
  }, 0);
  return container;
}
function resovleSource(source, output, options) {
  let buffer;
  if (ArrayBuffer.isView(source)) {
    buffer = source.buffer;
  } else if (source instanceof ArrayBuffer) {
    buffer = source;
  } else {
    const canvas = document.createElement("canvas");
    const { width, height } = options || {};
    const context2d = canvas.getContext("2d");
    if (!context2d) {
      throw new Error("Failed to create canvas context2d");
    }
    canvas.width = width ?? ("width" in source ? typeof source.width === "number" ? source.width : source.width.baseVal.value : 0);
    canvas.height = height ?? ("height" in source ? typeof source.height === "number" ? source.height : source.height.baseVal.value : 0);
    context2d.drawImage(source, 0, 0, canvas.width, canvas.height);
    buffer = context2d.getImageData(0, 0, canvas.width, canvas.height).data.buffer;
  }
  switch (output) {
    case "uint8Array":
      return new Uint8Array(buffer);
    case "uint8ClampedArray":
      return new Uint8ClampedArray(buffer);
    case "dataView":
      return new DataView(buffer);
    default:
      throw new Error("Unsupported output format");
  }
}
function createImage(url) {
  const img = new Image();
  img.decoding = "sync";
  img.loading = "eager";
  img.crossOrigin = "anonymous";
  img.src = url;
  return img;
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = createImage(url);
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

class Reader {
  _view;
  offset = 0;
  constructor(source) {
    this._view = resovleSource(source, "dataView");
  }
  readByte() {
    return this._view.getUint8(this.offset++);
  }
  readBytes(length) {
    return Array.from({ length }).map(() => this.readByte());
  }
  readString(length) {
    return String.fromCharCode(...this.readBytes(length));
  }
  readUnsigned() {
    return [this._view.getUint16(this.offset, true), this.offset += 2][0];
  }
  readBits() {
    return this._view.getUint8(this.offset++).toString(2).padStart(8, "0").split("").map(Number);
  }
  readColorTable(length) {
    return Array.from({ length }, () => Array.from(this.readBytes(3)));
  }
  readSubBlock() {
    const block = [];
    while (true) {
      const val = this.readByte();
      if (val === 0 && this._view.getUint8(this.offset) !== 0)
        break;
      block.push(val);
    }
    return block;
  }
}

function decode(source) {
  const gif = {};
  const reader = new Reader(source);
  const createFrame = () => ({ index: 0, delay: 100, disposal: 0 });
  const signature = reader.readString(3);
  const version = reader.readString(3);
  if (signature !== SIGNATURE || !VERSIONS.includes(version)) {
    throw new Error("This is not a 87a/89a GIF data.");
  }
  gif.version = version;
  gif.width = reader.readUnsigned();
  gif.height = reader.readUnsigned();
  const bits = reader.readBits();
  gif.globalColorTable = Boolean(bits[0]);
  gif.colorResoluTion = Number.parseInt(bits.slice(1, 4).join(""), 2) + 1;
  gif.colorTableSorted = Boolean(bits[4]);
  const colorTableSize = Number.parseInt(bits.slice(5, 8).join(""), 2);
  gif.colorTableSize = 2 ** (colorTableSize + 1);
  gif.backgroundColorIndex = reader.readByte();
  gif.pixelAspectRatio = reader.readByte();
  if (gif.globalColorTable) {
    if (gif.colorTableSize) {
      gif.colorTable = reader.readColorTable(gif.colorTableSize);
    } else {
      reader.readSubBlock();
    }
  }
  gif.frames = [];
  let frame = createFrame();
  const flags = [];
  const extensionFlags = [];
  while (true) {
    const flag = reader.readByte();
    flags.push(flag);
    if (flag === IMAGE_DESCRIPTOR) {
      frame.left = reader.readUnsigned();
      frame.top = reader.readUnsigned();
      frame.width = reader.readUnsigned();
      frame.height = reader.readUnsigned();
      const bits2 = reader.readBits();
      frame.localColorTable = Boolean(bits2[0]);
      frame.interlaced = Boolean(bits2[1]);
      frame.colorTableSorted = Boolean(bits2[2]);
      frame.reserved = Number.parseInt(bits2.slice(3, 5).join(""), 2);
      const colorTableSize2 = Number.parseInt(bits2.slice(5, 8).join(""), 2);
      frame.colorTableSize = 2 ** (colorTableSize2 + 1);
      if (frame.localColorTable) {
        frame.colorTable = reader.readColorTable(frame.colorTableSize);
      }
      frame.lzwMinCodeSize = reader.readByte();
      frame.dataPositions = [];
      while (true) {
        const length = reader.readByte();
        if (length === 0)
          break;
        const offset = reader.offset;
        frame.dataPositions.push([offset, length]);
        reader.offset = offset + length;
      }
      gif.frames.push(frame);
      frame = createFrame();
      frame.index = gif.frames.length;
      continue;
    }
    if (flag === EXTENSION) {
      const extensionFlag = reader.readByte();
      extensionFlags.push(extensionFlag);
      if (extensionFlag === EXTENSION_APPLICATION) {
        if (reader.readByte() !== EXTENSION_APPLICATION_BLOCK_SIZE)
          continue;
        const application = {
          identifier: reader.readString(8),
          code: reader.readString(3),
          data: []
        };
        if (`${application.identifier}${application.code}` === "NETSCAPE2.0") {
          if (reader.readByte() === 3) {
            gif.looped = Boolean(reader.readByte());
            gif.loopCount = reader.readUnsigned();
          }
        }
        application.data = reader.readSubBlock();
        frame.application = application;
        continue;
      }
      if (extensionFlag === EXTENSION_COMMENT) {
        frame.comment = reader.readSubBlock().map((val) => String.fromCharCode(val)).join("");
        continue;
      }
      if (extensionFlag === EXTENSION_GRAPHIC_CONTROL) {
        if (reader.readByte() !== EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE)
          continue;
        const bits2 = reader.readBits();
        const graphicControl = {
          // ↓ <Packed Fields>
          reserved: Number.parseInt(bits2.slice(0, 3).join(""), 2),
          disposal: Number.parseInt(bits2.slice(3, 6).join(""), 2),
          userInput: Boolean(bits2[6]),
          transparent: Boolean(bits2[7]),
          // ↑ <Packed Fields>
          delayTime: reader.readUnsigned(),
          transparentIndex: reader.readByte()
        };
        reader.readSubBlock();
        frame.graphicControl = graphicControl;
        frame.disposal = graphicControl.disposal;
        frame.delay = (graphicControl.delayTime || 10) * 10;
        continue;
      }
      if (extensionFlag === EXTENSION_PLAIN_TEXT) {
        if (reader.readByte() !== EXTENSION_PLAIN_TEXT_BLOCK_SIZE)
          continue;
        frame.plainText = {
          left: reader.readUnsigned(),
          top: reader.readUnsigned(),
          width: reader.readUnsigned(),
          height: reader.readUnsigned(),
          cellWidth: reader.readByte(),
          cellHeight: reader.readByte(),
          colorIndex: reader.readByte(),
          backgroundColorIndex: reader.readByte(),
          data: reader.readSubBlock()
        };
        continue;
      }
      console.warn(
        `Unknown extension block: 0x${extensionFlag.toString(16)}`,
        flags.slice(0, flags.length - 1).map((val) => `0x${val.toString(16)}`),
        extensionFlags.slice(0, extensionFlags.length - 1).map((val) => `0x${val.toString(16)}`)
      );
      continue;
    }
    if (flag === TRAILER)
      break;
    console.warn(
      `Unknown block: 0x${flag.toString(16)}`,
      flags.slice(0, flags.length - 1).map((val) => `0x${val.toString(16)}`),
      extensionFlags.slice(0, extensionFlags.length - 1).map((val) => `0x${val.toString(16)}`)
    );
  }
  return gif;
}

function createWorker(options) {
  const callbacks = /* @__PURE__ */ new Map();
  const { workerUrl } = options;
  let { workerNumber = 1 } = options;
  const workers = [...Array.from({ length: workerUrl ? workerNumber : 0 })].map(() => {
    try {
      const worker = new Worker(workerUrl);
      worker.onmessage = onMessage;
      return worker;
    } catch (err) {
      console.warn(err);
      return null;
    }
  }).filter(Boolean);
  workerNumber = workers.length;
  function onMessage(event) {
    const { id, data } = event.data;
    callbacks.get(id)?.(data);
    callbacks.delete(id);
  }
  const getWorker = /* @__PURE__ */ function() {
    let id = 0;
    return (index) => workers[(index ?? id++) % workerNumber];
  }();
  const call = /* @__PURE__ */ function() {
    let id = 0;
    return (type, data, transfer, index) => {
      return new Promise((resolve) => {
        const worker = getWorker(index);
        if (!worker)
          return resolve(void 0);
        callbacks.set(id, resolve);
        worker.postMessage({ id: id++, type, data }, { transfer });
      });
    };
  }();
  return {
    call
  };
}

function deinterlace(pixels, width) {
  const newPixels = Array.from({ length: pixels.length });
  const rows = pixels.length / width;
  const offsets = [0, 4, 2, 1];
  const steps = [8, 8, 4, 2];
  let fromRow = 0;
  for (let pass = 0; pass < 4; pass++) {
    for (let toRow = offsets[pass]; toRow < rows; toRow += steps[pass]) {
      newPixels.splice.apply(
        newPixels,
        [toRow * width, width].concat(
          pixels.slice(fromRow * width, (fromRow + 1) * width)
        )
      );
      fromRow++;
    }
  }
  return newPixels;
}

function lzwDecode(minCodeSize, data, pixelCount) {
  const MAX_STACK_SIZE = 4096;
  const nullCode = -1;
  const npix = pixelCount;
  let available, codeMask, codeSize, inCode, oldCode, code, i;
  const dstPixels = Array.from({ length: pixelCount });
  const prefix = Array.from({ length: MAX_STACK_SIZE });
  const suffix = Array.from({ length: MAX_STACK_SIZE });
  const pixelStack = Array.from({ length: MAX_STACK_SIZE + 1 });
  const dataSize = minCodeSize;
  const clear = 1 << dataSize;
  const endOfInformation = clear + 1;
  available = clear + 2;
  oldCode = nullCode;
  codeSize = dataSize + 1;
  codeMask = (1 << codeSize) - 1;
  for (code = 0; code < clear; code++) {
    prefix[code] = 0;
    suffix[code] = code;
  }
  let datum, bits, first, top, pi, bi;
  datum = bits = first = top = pi = bi = 0;
  for (i = 0; i < npix; ) {
    if (top === 0) {
      if (bits < codeSize) {
        datum += data[bi] << bits;
        bits += 8;
        bi++;
        continue;
      }
      code = datum & codeMask;
      datum >>= codeSize;
      bits -= codeSize;
      if (code > available || code === endOfInformation) {
        break;
      }
      if (code === clear) {
        codeSize = dataSize + 1;
        codeMask = (1 << codeSize) - 1;
        available = clear + 2;
        oldCode = nullCode;
        continue;
      }
      if (oldCode === nullCode) {
        pixelStack[top++] = suffix[code];
        oldCode = code;
        first = code;
        continue;
      }
      inCode = code;
      if (code === available) {
        pixelStack[top++] = first;
        code = oldCode;
      }
      while (code > clear) {
        pixelStack[top++] = suffix[code];
        code = prefix[code];
      }
      first = suffix[code] & 255;
      pixelStack[top++] = first;
      if (available < MAX_STACK_SIZE) {
        prefix[available] = oldCode;
        suffix[available] = first;
        available++;
        if ((available & codeMask) === 0 && available < MAX_STACK_SIZE) {
          codeSize++;
          codeMask += available;
        }
      }
      oldCode = inCode;
    }
    top--;
    dstPixels[pi++] = pixelStack[top];
    i++;
  }
  for (i = pi; i < npix; i++) {
    dstPixels[i] = 0;
  }
  return dstPixels;
}

function decodeFrames(source, options) {
  const array = resovleSource(source, "uint8Array");
  if (options?.workerUrl) {
    return createWorker({ workerUrl: options.workerUrl }).call(
      "frames:decode",
      array,
      [array.buffer]
    );
  }
  const {
    gif = decode(source),
    range
  } = options ?? {};
  const {
    width: globalWidth,
    height: globalHeight,
    colorTable: globalColorTable,
    frames: globalFrames
  } = gif;
  const frames = range ? globalFrames.slice(range[0], range[1] + 1) : globalFrames;
  const hasDisposal3 = frames.some((frame) => frame.disposal === 3);
  let pixels = new Uint8ClampedArray(globalWidth * globalHeight * 4);
  let previousFrame;
  let previousPixels = pixels.slice();
  return frames.map((frame) => {
    const {
      left,
      top,
      width,
      height,
      interlaced,
      localColorTable,
      colorTable,
      lzwMinCodeSize,
      dataPositions,
      graphicControl,
      delay,
      disposal
    } = frame;
    const previousDisposal = previousFrame?.disposal;
    const bottom = top + height;
    const {
      transparent,
      transparentIndex: localTransparentIndex
    } = graphicControl ?? {};
    const palette = localColorTable ? colorTable : globalColorTable;
    const transparentIndex = transparent ? localTransparentIndex : -1;
    const compressedData = mergeBuffers(
      dataPositions.map(
        ([begin, length]) => array.subarray(begin, begin + length)
      )
    );
    let colorIndexes = lzwDecode(lzwMinCodeSize, compressedData, width * height);
    if (interlaced) {
      colorIndexes = deinterlace(colorIndexes, width);
    }
    if (previousDisposal === 3) {
      pixels = previousPixels.slice();
    } else if (previousDisposal === 2) {
      const { left: left2, top: top2, width: width2, height: height2 } = previousFrame;
      const bottom2 = top2 + height2;
      for (let y = top2; y < bottom2; y++) {
        const globalOffset = y * globalWidth + left2;
        for (let x = 0; x < width2; x++) {
          const index = (globalOffset + x) * 4;
          pixels[index] = pixels[index + 1] = pixels[index + 2] = pixels[index + 3] = 0;
        }
      }
    }
    for (let y = top; y < bottom; y++) {
      const globalOffset = y * globalWidth + left;
      const localOffset = (y - top) * width;
      for (let x = 0; x < width; x++) {
        const colorIndex = colorIndexes[localOffset + x];
        const index = (globalOffset + x) * 4;
        if (colorIndex !== transparentIndex) {
          const [r, g, b] = palette?.[colorIndex] ?? [0, 0, 0];
          pixels[index] = r;
          pixels[index + 1] = g;
          pixels[index + 2] = b;
          pixels[index + 3] = 255;
        }
      }
    }
    if (hasDisposal3 && disposal !== 1 && disposal !== 3) {
      previousPixels = pixels.slice();
    }
    previousFrame = frame;
    return {
      width: globalWidth,
      height: globalHeight,
      delay,
      data: pixels.slice()
    };
  });
}

function decodeFrame(source, index, gif) {
  const frames = decodeFrames(source, {
    gif,
    range: [0, Math.max(index, 0)]
  });
  return frames.pop();
}

function decodeUndisposedFrame(source, gif, index) {
  const array = resovleSource(source, "uint8Array");
  const {
    frames,
    colorTable: globalColorTable
  } = gif;
  const frame = frames[index];
  if (!frame) {
    throw new Error(`This index ${index} does not exist in frames`);
  }
  const {
    width,
    height,
    delay,
    interlaced,
    localColorTable,
    colorTable,
    lzwMinCodeSize,
    dataPositions,
    graphicControl
  } = frame;
  const {
    transparent,
    transparentIndex: transparentIndex_
  } = graphicControl ?? {};
  const palette = localColorTable ? colorTable : globalColorTable;
  const transparentIndex = transparent ? transparentIndex_ : -1;
  const compressedData = mergeBuffers(
    dataPositions.map(
      ([begin, length]) => array.subarray(begin, begin + length)
    )
  );
  let colorIndexes = lzwDecode(lzwMinCodeSize, compressedData, width * height);
  if (interlaced) {
    colorIndexes = deinterlace(colorIndexes, width);
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let len = colorIndexes.length, i = 0; i < len; i++) {
    const colorIndex = colorIndexes[i];
    if (colorIndex === transparentIndex)
      continue;
    const [r, g, b] = palette?.[colorIndex] ?? [0, 0, 0];
    const index2 = i * 4;
    data[index2] = r;
    data[index2 + 1] = g;
    data[index2 + 2] = b;
    data[index2 + 3] = 255;
  }
  return {
    width,
    height,
    delay,
    data
  };
}

class Logger {
  constructor(isDebug = true) {
    this.isDebug = isDebug;
  }
  static prefix = "[modern-gif]";
  time(label) {
    if (!this.isDebug)
      return;
    console.time(`${Logger.prefix} ${label}`);
  }
  timeEnd(label) {
    if (!this.isDebug)
      return;
    console.timeEnd(`${Logger.prefix} ${label}`);
  }
  debug(...args) {
    if (!this.isDebug)
      return;
    console.debug(Logger.prefix, ...args);
  }
  warn(...args) {
    if (!this.isDebug)
      return;
    console.warn(Logger.prefix, ...args);
  }
}

class CropIndexedFrame {
  constructor(_config) {
    this._config = _config;
  }
  _rsControler;
  _frames = [];
  readable = new ReadableStream({
    start: (controler) => this._rsControler = controler
  });
  writable = new WritableStream({
    write: (frame) => {
      this._frames.push(frame);
    },
    close: () => {
      const transparentIndex = this._config.backgroundColorIndex;
      let lastIndexes;
      this._frames.forEach((frame, index) => {
        const {
          width = 1,
          height = 1,
          data: indexes
        } = frame;
        const transparent = frame.transparent || (this._frames[index + 1]?.transparent ?? true);
        let left = 0;
        let top = 0;
        let right = width - 1;
        let bottom = height - 1;
        let prevIndexes;
        if (transparent) {
          while (top < bottom) {
            let isTrans = true;
            for (let x = 0; x < width; x++) {
              if (indexes[width * top + x] !== transparentIndex) {
                isTrans = false;
                break;
              }
            }
            if (!isTrans)
              break;
            top++;
          }
          while (bottom > top) {
            let isTrans = true;
            for (let x = 0; x < width; x++) {
              if (indexes[width * bottom + x] !== transparentIndex) {
                isTrans = false;
                break;
              }
            }
            if (!isTrans)
              break;
            bottom--;
          }
          while (left < right) {
            let isTrans = true;
            for (let y = top; y < bottom; y++) {
              if (indexes[width * y + left] !== transparentIndex) {
                isTrans = false;
                break;
              }
            }
            if (!isTrans)
              break;
            left++;
          }
          while (right > left) {
            let isTrans = true;
            for (let y = top; y < bottom; y++) {
              if (indexes[width * y + right] !== transparentIndex) {
                isTrans = false;
                break;
              }
            }
            if (!isTrans)
              break;
            right--;
          }
        } else {
          if (lastIndexes) {
            while (top < bottom) {
              let sameLine = true;
              for (let x = 0; x < width; x++) {
                const index2 = width * top + x;
                if (indexes[index2] !== lastIndexes[index2]) {
                  sameLine = false;
                  break;
                }
              }
              if (!sameLine)
                break;
              top++;
            }
            while (bottom > top) {
              let sameLine = true;
              for (let x = 0; x < width; x++) {
                const index2 = width * bottom + x;
                if (indexes[index2] !== lastIndexes[index2]) {
                  sameLine = false;
                  break;
                }
              }
              if (!sameLine)
                break;
              bottom--;
            }
            if (top === bottom) {
              left = right;
            } else {
              while (left < right) {
                let sameColumn = true;
                for (let y = top; y <= bottom; y++) {
                  const index2 = y * width + left;
                  if (indexes[index2] !== lastIndexes[index2]) {
                    sameColumn = false;
                    break;
                  }
                }
                if (!sameColumn)
                  break;
                left++;
              }
              while (right > left) {
                let sameColumn = true;
                for (let y = top; y <= bottom; y++) {
                  const index2 = y * width + right;
                  if (indexes[index2] !== lastIndexes[index2]) {
                    sameColumn = false;
                    break;
                  }
                }
                if (!sameColumn)
                  break;
                right--;
              }
            }
          }
          prevIndexes = lastIndexes;
          lastIndexes = indexes;
        }
        const newWidth = right + 1 - left;
        const newHeight = bottom + 1 - top;
        const croppedIndexes = new Uint8ClampedArray(newWidth * newHeight);
        for (let y = 0; y < newHeight; y++) {
          for (let x = 0; x < newWidth; x++) {
            const index2 = y * newWidth + x;
            const rawIndex = (top + y) * width + (left + x);
            if (!transparent && prevIndexes && indexes[rawIndex] === prevIndexes[rawIndex]) {
              croppedIndexes[index2] = transparentIndex;
              continue;
            }
            croppedIndexes[index2] = indexes[rawIndex];
          }
        }
        this._rsControler.enqueue({
          ...frame,
          left,
          top,
          width: newWidth,
          height: newHeight,
          disposal: transparent ? 2 : 1,
          data: croppedIndexes,
          graphicControl: {
            ...frame.graphicControl,
            transparent: true,
            transparentIndex
          }
        });
      });
      this._rsControler.close();
    }
  });
}

class Writer {
  constructor(_chunkByteLength = 4096) {
    this._chunkByteLength = _chunkByteLength;
    this._chunks = [this._createChunk()];
  }
  _chunks;
  _chunkIndex = 0;
  _chunkOffset = 0;
  get cursor() {
    return [this._chunkIndex, this._chunkOffset];
  }
  _createChunk() {
    return new DataView(new ArrayBuffer(this._chunkByteLength));
  }
  writeByte(val, cursor) {
    if (cursor) {
      this._chunks[cursor[0]].setUint8(cursor[1], val);
    } else {
      if (this._chunkOffset >= this._chunkByteLength) {
        this._chunks[++this._chunkIndex] = this._createChunk();
        this._chunkOffset = 0;
      }
      this._chunks[this._chunkIndex].setUint8(this._chunkOffset++, val);
    }
  }
  writeBytes(value) {
    value.forEach((val) => this.writeByte(val));
  }
  writeString(value) {
    value.split("").forEach((char) => {
      this.writeByte(char.charCodeAt(0));
    });
  }
  writeUnsigned(value) {
    this.writeBytes([value & 255, value >> 8 & 255]);
  }
  calculateDistance(cursor) {
    return this._chunkIndex * this._chunkByteLength + this._chunkOffset - (cursor[0] * this._chunkByteLength + cursor[1]);
  }
  toUint8Array() {
    this._chunks[this._chunkIndex] = new DataView(this._chunks[this._chunkIndex].buffer.slice(0, this._chunkOffset));
    const data = new Uint8Array(this._chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
    let offset = 0;
    this._chunks.forEach((chunk) => {
      data.set(new Uint8Array(chunk.buffer), offset);
      offset += chunk.byteLength;
    });
    this._chunks = [this._createChunk()];
    this._chunkIndex = 0;
    this._chunkOffset = 0;
    return data;
  }
}

class EncodeGif {
  constructor(_config) {
    this._config = _config;
  }
  _rsControler;
  _frames = [];
  readable = new ReadableStream({
    start: (controler) => this._rsControler = controler
  });
  writable = new WritableStream({
    write: (frame) => {
      this._frames.push(frame);
    },
    close: () => {
      const header = this._encodeHeader();
      const body = mergeBuffers(this._frames);
      const output = new Uint8Array(header.length + body.byteLength + 1);
      output.set(header);
      output.set(body, header.byteLength);
      output[output.length - 1] = TRAILER;
      this._rsControler.enqueue(output);
      this._rsControler.close();
      this._frames.length = 0;
    }
  });
  _encodeHeader() {
    const gif = {
      version: "89a",
      looped: true,
      loopCount: 0,
      pixelAspectRatio: 0,
      ...this._config
    };
    if (gif.width <= 0 || gif.width > 65535)
      throw new Error("Width invalid.");
    if (gif.height <= 0 || gif.height > 65535)
      throw new Error("Height invalid.");
    let colorTableSize = 0;
    if (gif.colorTable?.length) {
      let colorTableLength = gif.colorTable.length;
      if (colorTableLength < 2 || colorTableLength > 256 || colorTableLength & colorTableLength - 1) {
        throw new Error("Invalid color table length, must be power of 2 and 2 .. 256.");
      }
      while (colorTableLength >>= 1) ++colorTableSize;
      colorTableLength = 1 << colorTableSize;
      gif.colorTableSize = --colorTableSize;
      if (gif.backgroundColorIndex >= colorTableLength) {
        throw new Error("Background index out of range.");
      }
      if (gif.backgroundColorIndex === 0) {
        throw new Error("Background index explicitly passed as 0.");
      }
    }
    const writer = new Writer();
    writer.writeString(SIGNATURE);
    writer.writeString(gif.version);
    writer.writeUnsigned(gif.width);
    writer.writeUnsigned(gif.height);
    writer.writeByte(Number.parseInt(`${gif.colorTableSize ? 1 : 0}1110${gif.colorTableSize.toString(2).padStart(3, "0")}`, 2));
    writer.writeByte(gif.backgroundColorIndex);
    writer.writeByte(gif.pixelAspectRatio);
    writer.writeBytes(gif.colorTable?.flat() ?? []);
    if (gif.looped) {
      writer.writeByte(EXTENSION);
      writer.writeByte(EXTENSION_APPLICATION);
      writer.writeByte(EXTENSION_APPLICATION_BLOCK_SIZE);
      writer.writeString("NETSCAPE2.0");
      writer.writeByte(3);
      writer.writeByte(1);
      writer.writeUnsigned(gif.loopCount);
      writer.writeByte(0);
    }
    return writer.toUint8Array();
  }
}

function lzwEncode(minCodeSize, data, writer) {
  writer.writeByte(minCodeSize);
  let curSubblock = writer.cursor;
  writer.writeByte(0);
  const clearCode = 1 << minCodeSize;
  const codeMask = clearCode - 1;
  const eoiCode = clearCode + 1;
  let nextCode = eoiCode + 1;
  let curCodeSize = minCodeSize + 1;
  let curShift = 0;
  let cur = 0;
  function emitBytesToBuffer(bitBlockSize) {
    while (curShift >= bitBlockSize) {
      writer.writeByte(cur & 255);
      cur >>= 8;
      curShift -= 8;
      if (writer.calculateDistance(curSubblock) === 256) {
        writer.writeByte(255, curSubblock);
        curSubblock = writer.cursor;
        writer.writeByte(0);
      }
    }
  }
  function emitCode(c) {
    cur |= c << curShift;
    curShift += curCodeSize;
    emitBytesToBuffer(8);
  }
  let ibCode = data[0] & codeMask;
  let codeTable = {};
  let curKey;
  let curCode;
  let k;
  emitCode(clearCode);
  for (let len = data.length, i = 1; i < len; ++i) {
    k = data[i] & codeMask;
    curKey = ibCode << 8 | k;
    curCode = codeTable[curKey];
    if (curCode === void 0) {
      cur |= ibCode << curShift;
      curShift += curCodeSize;
      while (curShift >= 8) {
        writer.writeByte(cur & 255);
        cur >>= 8;
        curShift -= 8;
        if (writer.calculateDistance(curSubblock) === 256) {
          writer.writeByte(255, curSubblock);
          curSubblock = writer.cursor;
          writer.writeByte(0);
        }
      }
      if (nextCode === 4096) {
        emitCode(clearCode);
        nextCode = eoiCode + 1;
        curCodeSize = minCodeSize + 1;
        codeTable = {};
      } else {
        if (nextCode >= 1 << curCodeSize)
          ++curCodeSize;
        codeTable[curKey] = nextCode++;
      }
      ibCode = k;
    } else {
      ibCode = curCode;
    }
  }
  emitCode(ibCode);
  emitCode(eoiCode);
  emitBytesToBuffer(1);
  if (writer.calculateDistance(curSubblock) === 1) {
    writer.writeByte(0, curSubblock);
  } else {
    writer.writeByte(writer.calculateDistance(curSubblock) - 1, curSubblock);
    writer.writeByte(0);
  }
}

class EncodeIndexdFrame {
  constructor(_config) {
    this._config = _config;
  }
  _rsControler;
  readable = new ReadableStream({
    start: (controler) => this._rsControler = controler
  });
  writable = new WritableStream({
    write: (frame) => {
      const writer = new Writer();
      const {
        left = 0,
        top = 0,
        width = 0,
        height = 0,
        delay = 100,
        colorTable
      } = frame;
      let {
        disposal = 0
      } = frame;
      const transparent = frame.graphicControl?.transparent;
      let transparentIndex = frame.graphicControl?.transparentIndex ?? 255;
      if (left < 0 || left > 65535)
        throw new Error("Left invalid.");
      if (top < 0 || top > 65535)
        throw new Error("Top invalid.");
      if (width <= 0 || width > 65535)
        throw new Error("Width invalid.");
      if (height <= 0 || height > 65535)
        throw new Error("Height invalid.");
      let minCodeSize = 8;
      let colorTableLength = colorTable ? colorTable.length : 0;
      if (colorTableLength) {
        if (colorTableLength < 2 || colorTableLength > 256 || colorTableLength & colorTableLength - 1) {
          throw new Error("Invalid color table length, must be power of 2 and 2 .. 256.");
        }
        while (colorTableLength >>= 1) ++minCodeSize;
      }
      writer.writeByte(EXTENSION);
      writer.writeByte(EXTENSION_GRAPHIC_CONTROL);
      writer.writeByte(EXTENSION_GRAPHIC_CONTROL_BLOCK_SIZE);
      if (transparent) {
        if (!disposal) {
          disposal = 2;
        }
      } else {
        transparentIndex = 0;
      }
      writer.writeByte(Number.parseInt(`000${Number(disposal & 7).toString(2).padStart(3, "0")}0${transparent ? 1 : 0}`, 2));
      writer.writeUnsigned(delay / 10);
      writer.writeByte(transparentIndex);
      writer.writeByte(0);
      writer.writeByte(IMAGE_DESCRIPTOR);
      writer.writeUnsigned(left);
      writer.writeUnsigned(top);
      writer.writeUnsigned(width);
      writer.writeUnsigned(height);
      if (colorTable?.length) {
        writer.writeByte(Number.parseInt(`10000${(minCodeSize - 1).toString(2).padStart(3, "0")}`, 2));
        writer.writeBytes(colorTable.flat());
      } else {
        writer.writeByte(0);
      }
      lzwEncode(minCodeSize, frame.data, writer);
      this._rsControler.enqueue(writer.toUint8Array());
    },
    close: () => this._rsControler.close()
  });
}

const ditherKernels = {
  "floyd-steinberg": [
    [7 / 16, 1, 0],
    [3 / 16, -1, 1],
    [5 / 16, 0, 1],
    [1 / 16, 1, 1]
  ],
  "atkinson": [
    [1 / 8, 1, 0],
    [1 / 8, 2, 0],
    [1 / 8, -1, 1],
    [1 / 8, 0, 1],
    [1 / 8, 1, 1],
    [1 / 8, 0, 2]
  ],
  "stucki": [
    [8 / 42, 1, 0],
    [4 / 42, 2, 0],
    [2 / 42, -2, 1],
    [4 / 42, -1, 1],
    [8 / 42, 0, 1],
    [4 / 42, 1, 1],
    [2 / 42, 2, 1],
    [1 / 42, -2, 2],
    [2 / 42, -1, 2],
    [4 / 42, 0, 2],
    [2 / 42, 1, 2],
    [1 / 42, 2, 2]
  ]
};
class FrameToIndexedFrame {
  constructor(_config, colors) {
    this._config = _config;
    this._finder = new Finder(colors, _config.premultipliedAlpha, _config.tint);
    this._colors = colors;
  }
  _rsControler;
  _finder;
  _colors;
  readable = new ReadableStream({
    start: (controler) => this._rsControler = controler
  });
  writable = new WritableStream({
    write: (frame) => {
      const transparentIndex = this._config.backgroundColorIndex;
      const pixels = frame.data;
      if (frame.width && frame.height && (this._config.dither || this._config.ditherTransparency)) {
        const pos = (x, y, c) => (y * frame.width + x) * 4 + c;
        if (this._config.dither) {
          const kernel = ditherKernels[this._config.dither];
          for (let y = 0; y < frame.height; y++) {
            for (let x = 0; x < frame.width; x++) {
              const p = pos(x, y, 0);
              const oldRGB = {
                r: pixels[p],
                g: pixels[p + 1],
                b: pixels[p + 2]
              };
              const newRGB = this._colors[this._finder.findNearestIndex(
                oldRGB.r,
                oldRGB.g,
                oldRGB.b,
                this._config.premultipliedAlpha ? pixels[p + 3] : 255
              )].rgb;
              const error = {
                r: oldRGB.r - newRGB.r,
                g: oldRGB.g - newRGB.g,
                b: oldRGB.b - newRGB.b
              };
              pixels[p] = newRGB.r;
              pixels[p + 1] = newRGB.g;
              pixels[p + 2] = newRGB.b;
              for (const [weight, xOffset, yOffset] of kernel) {
                const xCheck = xOffset < 0 ? x + xOffset >= 0 : x + xOffset < frame.width;
                const yCheck = yOffset < 0 ? y + yOffset >= 0 : y + yOffset < frame.height;
                if (xCheck && yCheck) {
                  const p2 = pos(x + xOffset, y + yOffset, 0);
                  pixels[p2] += error.r * weight;
                  pixels[p2 + 1] += error.g * weight;
                  pixels[p2 + 2] += error.b * weight;
                }
              }
            }
          }
        }
        if (this._config.ditherTransparency) {
          const kernel = ditherKernels[this._config.ditherTransparency];
          for (let y = 0; y < frame.height; y++) {
            for (let x = 0; x < frame.width; x++) {
              const p = pos(x, y, 3);
              const oldAlpha = pixels[p];
              const newAlpha = oldAlpha < 128 ? 0 : 255;
              const error = oldAlpha - newAlpha;
              pixels[p] = newAlpha;
              for (const [weight, xOffset, yOffset] of kernel) {
                const xCheck = xOffset < 0 ? x + xOffset >= 0 : x + xOffset < frame.width;
                const yCheck = yOffset < 0 ? y + yOffset >= 0 : y + yOffset < frame.height;
                if (xCheck && yCheck) {
                  const p2 = pos(x + xOffset, y + yOffset, 3);
                  pixels[p2] += error * weight;
                }
              }
            }
          }
        }
      }
      let transparent = false;
      const indexes = new Uint8ClampedArray(pixels.length / 4);
      for (let len = pixels.length, i = 0; i < len; i += 4) {
        if (pixels[i + 3] === 0) {
          indexes[i / 4] = transparentIndex;
          transparent = true;
        } else {
          indexes[i / 4] = this._finder.findNearestIndex(
            pixels[i],
            pixels[i + 1],
            pixels[i + 2],
            pixels[i + 3]
          );
        }
      }
      this._rsControler.enqueue({
        ...frame,
        data: indexes,
        transparent
      });
    },
    close: () => {
      this._rsControler.close();
    }
  });
}

class Encoder {
  _logger;
  _palette;
  _config;
  _encodingFrames = [];
  _encodeUUID = 0;
  _worker;
  constructor(options) {
    this._logger = new Logger(Boolean(options.debug));
    this._config = this._resolveOptions(options);
    this._palette = new Palette({
      maxColors: this._config.maxColors,
      premultipliedAlpha: this._config.premultipliedAlpha,
      tint: this._config.tint
    });
    if (this._config.workerUrl) {
      this._worker = createWorker({ workerUrl: this._config.workerUrl });
      this._worker.call("encoder:init", options);
    } else {
      this._config.frames?.forEach((frame) => this.encode(frame));
    }
  }
  _resolveOptions(options) {
    ["width", "height"].forEach((key) => {
      if (typeof options[key] !== "undefined" && Math.floor(options[key]) !== options[key]) {
        console.warn(`${key} cannot be a floating point number`);
        options[key] = Math.floor(options[key]);
      }
    });
    const {
      colorTableSize = 256,
      backgroundColorIndex = colorTableSize - 1,
      maxColors = colorTableSize - 1,
      premultipliedAlpha = false,
      tint = [255, 255, 255]
    } = options;
    return {
      ...options,
      colorTableSize,
      backgroundColorIndex,
      maxColors,
      premultipliedAlpha,
      tint
    };
  }
  async encode(frame) {
    if (this._worker) {
      let transfer;
      if (ArrayBuffer.isView(frame.data)) {
        transfer = [frame.data.buffer];
      } else if (frame.data instanceof ArrayBuffer) {
        transfer = [frame.data];
      }
      return this._worker.call("encoder:encode", frame, transfer);
    }
    const id = this._encodeUUID;
    this._encodeUUID++;
    const {
      width: frameWidth = this._config.width,
      height: frameHeight = this._config.height
    } = frame;
    let { data } = frame;
    try {
      this._logger.time(`palette:sample-${id}`);
      data = typeof data === "string" ? await loadImage(data) : data;
      data = resovleSource(data, "uint8ClampedArray", {
        width: frameWidth,
        height: frameHeight
      });
      this._encodingFrames.push({
        ...frame,
        width: frameWidth,
        height: frameHeight,
        data
      });
      this._palette.addSample(data);
    } finally {
      this._logger.timeEnd(`palette:sample-${id}`);
    }
  }
  async flush(format) {
    if (this._worker) {
      return this._worker.call("encoder:flush", format);
    }
    this._logger.time("palette:generate");
    const colors = await this._palette.generate();
    this._logger.timeEnd("palette:generate");
    const colorTable = colors.map((color) => [color.rgb.r, color.rgb.g, color.rgb.b]);
    while (colorTable.length < this._config.colorTableSize) {
      colorTable.push([0, 0, 0]);
    }
    this._logger.debug("palette:maxColors", this._config.maxColors);
    this._logger.isDebug && console.debug(
      colors.map(() => "%c ").join(""),
      ...colors.map((color) => `margin: 1px; background: ${color.hex}`)
    );
    this._logger.time("encode");
    const output = await new Promise((resolve) => {
      new ReadableStream({
        start: (controller) => {
          this._encodingFrames.forEach((frame) => {
            controller.enqueue(frame);
          });
          controller.close();
        }
      }).pipeThrough(new FrameToIndexedFrame(this._config, colors)).pipeThrough(new CropIndexedFrame(this._config)).pipeThrough(new EncodeIndexdFrame(this._config)).pipeThrough(new EncodeGif({ ...this._config, colorTable })).pipeTo(new WritableStream({ write: (chunk) => resolve(chunk) }));
    });
    this._logger.timeEnd("encode");
    this._encodingFrames = [];
    this._encodeUUID = 0;
    switch (format) {
      case "blob":
        return new Blob([output.buffer], { type: "image/gif" });
      case "arrayBuffer":
      default:
        return output.buffer;
    }
  }
}

function encode(options) {
  return new Encoder(options).flush(options.format);
}

export { Encoder, decode, decodeFrame, decodeFrames, decodeUndisposedFrame, encode };
