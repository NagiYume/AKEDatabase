(function () {
    'use strict';

    if (window.AKEWatermark) return;

    const BLOCK_SIZE = 8;
    const HEADER_SIZE = 11;
    const MAGIC = Object.freeze([0x41, 0x4b, 0x45, 0x57]);
    const VERSION = 2;
    const MIN_ALPHA = 16;
    const COEFFICIENT_A = [2, 3];
    const COEFFICIENT_B = [3, 2];
    const QUANTIZATION_STEP = 12;
    const MIN_MEAN_LUMINANCE = 12;
    const MAX_MEAN_LUMINANCE = 243;
    const MAX_PAYLOAD_BYTES = 1024;
    const COSINES = Array.from({ length: BLOCK_SIZE }, (_, u) => Array.from({ length: BLOCK_SIZE }, (_, x) =>
        Math.cos(((2 * x + 1) * u * Math.PI) / (2 * BLOCK_SIZE))
    ));
    const NORMALIZATION = Array.from({ length: BLOCK_SIZE }, (_, value) => value === 0 ? 1 / Math.sqrt(2) : 1);
    const textEncoder = typeof TextEncoder === 'function' ? new TextEncoder() : null;
    const textDecoder = typeof TextDecoder === 'function' ? new TextDecoder() : null;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function hashText(value) {
        let hash = 2166136261;
        for (const character of String(value ?? '')) {
            hash ^= character.codePointAt(0);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    function randomId() {
        const bytes = new Uint8Array(8);
        if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
        else {
            for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
        }
        return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    }

    function crc32(bytes) {
        let crc = 0xffffffff;
        for (const byte of bytes) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit += 1) {
                crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
            }
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    function writeUint32(target, offset, value) {
        target[offset] = (value >>> 24) & 0xff;
        target[offset + 1] = (value >>> 16) & 0xff;
        target[offset + 2] = (value >>> 8) & 0xff;
        target[offset + 3] = value & 0xff;
    }

    function readUint32(source, offset) {
        return (((source[offset] << 24) >>> 0)
            | (source[offset + 1] << 16)
            | (source[offset + 2] << 8)
            | source[offset + 3]) >>> 0;
    }

    function bytesToBits(bytes) {
        const bits = [];
        bytes.forEach(byte => {
            for (let bit = 7; bit >= 0; bit -= 1) bits.push((byte >>> bit) & 1);
        });
        return bits;
    }

    function bitsToBytes(bits) {
        const bytes = new Uint8Array(Math.floor(bits.length / 8));
        for (let index = 0; index < bytes.length; index += 1) {
            let value = 0;
            for (let bit = 0; bit < 8; bit += 1) value = (value << 1) | bits[index * 8 + bit];
            bytes[index] = value;
        }
        return bytes;
    }

    function luminance(red, green, blue) {
        return red * 0.299 + green * 0.587 + blue * 0.114;
    }

    function blockData(imageData, x, y) {
        const values = new Float64Array(BLOCK_SIZE * BLOCK_SIZE);
        let offset = 0;
        let sum = 0;
        let eligible = true;
        for (let row = 0; row < BLOCK_SIZE; row += 1) {
            for (let column = 0; column < BLOCK_SIZE; column += 1) {
                const pixel = ((y + row) * imageData.width + x + column) * 4;
                const alpha = imageData.data[pixel + 3];
                if (alpha < MIN_ALPHA) eligible = false;
                const value = luminance(
                    imageData.data[pixel],
                    imageData.data[pixel + 1],
                    imageData.data[pixel + 2]
                );
                values[offset] = value;
                sum += value;
                offset += 1;
            }
        }
        const mean = sum / values.length;
        if (mean <= MIN_MEAN_LUMINANCE || mean >= MAX_MEAN_LUMINANCE) eligible = false;
        return { values, eligible };
    }

    function dct(values) {
        const coefficients = new Float64Array(values.length);
        for (let u = 0; u < BLOCK_SIZE; u += 1) {
            for (let v = 0; v < BLOCK_SIZE; v += 1) {
                let sum = 0;
                for (let y = 0; y < BLOCK_SIZE; y += 1) {
                    for (let x = 0; x < BLOCK_SIZE; x += 1) {
                        sum += values[y * BLOCK_SIZE + x] * COSINES[u][x] * COSINES[v][y];
                    }
                }
                coefficients[u * BLOCK_SIZE + v] = 0.25 * NORMALIZATION[u] * NORMALIZATION[v] * sum;
            }
        }
        return coefficients;
    }

    function inverseDct(coefficients) {
        const values = new Float64Array(coefficients.length);
        for (let y = 0; y < BLOCK_SIZE; y += 1) {
            for (let x = 0; x < BLOCK_SIZE; x += 1) {
                let sum = 0;
                for (let u = 0; u < BLOCK_SIZE; u += 1) {
                    for (let v = 0; v < BLOCK_SIZE; v += 1) {
                        sum += NORMALIZATION[u] * NORMALIZATION[v]
                            * coefficients[u * BLOCK_SIZE + v]
                            * COSINES[u][x] * COSINES[v][y];
                    }
                }
                values[y * BLOCK_SIZE + x] = 0.25 * sum;
            }
        }
        return values;
    }

    function blockCandidates(imageData) {
        const candidates = [];
        const maxX = imageData.width - BLOCK_SIZE;
        const maxY = imageData.height - BLOCK_SIZE;
        for (let y = 0; y <= maxY; y += BLOCK_SIZE) {
            for (let x = 0; x <= maxX; x += BLOCK_SIZE) {
                const source = blockData(imageData, x, y);
                if (!source.eligible) continue;
                candidates.push({ x, y });
            }
        }
        return candidates;
    }

    function seedFor(imageData) {
        return Number.parseInt(hashText(`${imageData.width}x${imageData.height}:AKEW`), 16) >>> 0;
    }

    function shuffleCandidates(candidates, seed) {
        let state = seed || 1;
        const next = () => {
            state = Math.imul(state ^ (state >>> 15), 2246822519);
            state = Math.imul(state ^ (state >>> 13), 3266489917);
            return (state ^ (state >>> 16)) >>> 0;
        };
        for (let index = candidates.length - 1; index > 0; index -= 1) {
            const swapIndex = next() % (index + 1);
            [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
        }
        return candidates;
    }

    function packetFor(metadata) {
        if (!textEncoder) throw new Error('当前浏览器不支持 UTF-8 水印编码');
        const payload = textEncoder.encode(JSON.stringify(metadata || {}));
        if (payload.length > MAX_PAYLOAD_BYTES) throw new Error('水印信息过长');
        const packet = new Uint8Array(HEADER_SIZE + payload.length);
        packet.set(MAGIC, 0);
        packet[4] = VERSION;
        packet[5] = (payload.length >>> 8) & 0xff;
        packet[6] = payload.length & 0xff;
        writeUint32(packet, 7, crc32(payload));
        packet.set(payload, HEADER_SIZE);
        return packet;
    }

    function coefficientBit(difference) {
        const index = Math.round(difference / QUANTIZATION_STEP);
        return ((index % 2) + 2) % 2;
    }

    function modifyBlock(imageData, candidate, bit) {
        const firstIndex = COEFFICIENT_A[0] * BLOCK_SIZE + COEFFICIENT_A[1];
        const secondIndex = COEFFICIENT_B[0] * BLOCK_SIZE + COEFFICIENT_B[1];
        for (let attempt = 0; attempt < 4; attempt += 1) {
            const source = blockData(imageData, candidate.x, candidate.y);
            const coefficients = dct(source.values);
            const difference = coefficients[firstIndex] - coefficients[secondIndex];
            const currentIndex = Math.round(difference / QUANTIZATION_STEP);
            if (coefficientBit(difference) === bit) return true;
            const lowerIndex = currentIndex - 1;
            const upperIndex = currentIndex + 1;
            const lowerTarget = lowerIndex * QUANTIZATION_STEP;
            const upperTarget = upperIndex * QUANTIZATION_STEP;
            const target = Math.abs(lowerTarget - difference) <= Math.abs(upperTarget - difference)
                ? lowerTarget
                : upperTarget;
            const adjustment = (target - difference) / 2;
            coefficients[firstIndex] += adjustment;
            coefficients[secondIndex] -= adjustment;
            const values = inverseDct(coefficients);
            let offset = 0;
            for (let row = 0; row < BLOCK_SIZE; row += 1) {
                for (let column = 0; column < BLOCK_SIZE; column += 1) {
                    const pixel = ((candidate.y + row) * imageData.width + candidate.x + column) * 4;
                    const delta = values[offset] - source.values[offset];
                    imageData.data[pixel] = clamp(Math.round(imageData.data[pixel] + delta), 0, 255);
                    imageData.data[pixel + 1] = clamp(Math.round(imageData.data[pixel + 1] + delta), 0, 255);
                    imageData.data[pixel + 2] = clamp(Math.round(imageData.data[pixel + 2] + delta), 0, 255);
                    offset += 1;
                }
            }
        }
        return coefficientBit(
            (() => {
                const source = blockData(imageData, candidate.x, candidate.y);
                const coefficients = dct(source.values);
                return coefficients[firstIndex] - coefficients[secondIndex];
            })()
        ) === bit;
    }

    function readBlockBit(imageData, candidate) {
        const source = blockData(imageData, candidate.x, candidate.y);
        const coefficients = dct(source.values);
        const firstIndex = COEFFICIENT_A[0] * BLOCK_SIZE + COEFFICIENT_A[1];
        const secondIndex = COEFFICIENT_B[0] * BLOCK_SIZE + COEFFICIENT_B[1];
        return coefficientBit(coefficients[firstIndex] - coefficients[secondIndex]);
    }

    function embed(imageData, metadata) {
        if (!imageData?.data || !imageData.width || !imageData.height) {
            return { ok: false, reason: 'invalid-image-data', imageData };
        }
        const packet = packetFor(metadata);
        const bits = bytesToBits(packet);
        const candidates = shuffleCandidates(blockCandidates(imageData), seedFor(imageData));
        if (candidates.length < bits.length) {
            return { ok: false, reason: 'insufficient-capacity', imageData, required: bits.length, available: candidates.length };
        }
        for (let index = 0; index < bits.length; index += 1) {
            if (!modifyBlock(imageData, candidates[index], bits[index])) {
                return { ok: false, reason: 'quantization-failed', imageData, index };
            }
        }
        const verificationCandidates = shuffleCandidates(blockCandidates(imageData), seedFor(imageData));
        if (!readPacket(imageData, verificationCandidates)) {
            return { ok: false, reason: 'verification-failed', imageData };
        }
        return { ok: true, imageData, bytes: packet.length, blocks: bits.length };
    }

    function readPacket(imageData, candidates) {
        const bitCount = HEADER_SIZE * 8;
        if (candidates.length < bitCount) return null;
        const headerBits = candidates.slice(0, bitCount).map(candidate => readBlockBit(imageData, candidate));
        const header = bitsToBytes(headerBits);
        if (!MAGIC.every((value, index) => header[index] === value) || header[4] !== VERSION) return null;
        const payloadLength = (header[5] << 8) | header[6];
        if (payloadLength > MAX_PAYLOAD_BYTES) return null;
        const totalBits = (HEADER_SIZE + payloadLength) * 8;
        if (candidates.length < totalBits) return null;
        const bits = candidates.slice(0, totalBits).map(candidate => readBlockBit(imageData, candidate));
        const packet = bitsToBytes(bits);
        const payload = packet.slice(HEADER_SIZE);
        if (crc32(payload) !== readUint32(packet, 7)) return null;
        if (!textDecoder) throw new Error('当前浏览器不支持 UTF-8 水印解码');
        try {
            return JSON.parse(textDecoder.decode(payload));
        } catch {
            return null;
        }
    }

    function decode(imageData) {
        if (!imageData?.data || !imageData.width || !imageData.height) {
            return { ok: false, reason: 'invalid-image-data' };
        }
        const candidates = shuffleCandidates(blockCandidates(imageData), seedFor(imageData));
        const metadata = readPacket(imageData, candidates);
        return metadata ? { ok: true, metadata, blocks: candidates.length } : { ok: false, reason: 'not-found' };
    }

    window.AKEWatermark = Object.freeze({
        version: VERSION,
        hashText,
        randomId,
        embed,
        decode
    });
})();
