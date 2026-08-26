(function () {
    'use strict';

    if (window.AKEWatermark) return;

    const BLOCK_SIZE = 8;
    const HEADER_SIZE = 11;
    const MAGIC = Object.freeze([0x41, 0x4b, 0x45, 0x57]);
    const VERSION = 3;
    const MIN_ALPHA = 16;
    const COEFFICIENT_A = [2, 3];
    const COEFFICIENT_B = [3, 2];
    const COEFFICIENT_C = [1, 2];
    const COEFFICIENT_D = [2, 1];
    const QUANTIZATION_STEP = 32;
    const MIN_MEAN_LUMINANCE = 12;
    const MAX_MEAN_LUMINANCE = 243;
    const MAX_PAYLOAD_BYTES = 512;
    const TILE_LAYOUTS = Object.freeze([
        Object.freeze({ width: 400, height: 208 }),
        Object.freeze({ width: 400, height: 320 }),
        Object.freeze({ width: 400, height: 400 })
    ]);
    const MAX_EMBED_TILES = 2;
    const PRECHECK_SYMBOLS_PER_COPY = 4;
    const PREAMBLE_REPETITIONS = 2;
    const PAYLOAD_SCHEMA = 1;
    const TILE_PREAMBLE_SYMBOLS = ((MAGIC.length + 1) * 8 * PREAMBLE_REPETITIONS) / 2;
    const COSINES = Array.from({ length: BLOCK_SIZE }, (_, u) => Array.from({ length: BLOCK_SIZE }, (_, x) =>
        Math.cos(((2 * x + 1) * u * Math.PI) / (2 * BLOCK_SIZE))
    ));
    const NORMALIZATION = Array.from({ length: BLOCK_SIZE }, (_, value) => value === 0 ? 1 / Math.sqrt(2) : 1);
    const firstCoefficientIndex = COEFFICIENT_A[0] * BLOCK_SIZE + COEFFICIENT_A[1];
    const secondCoefficientIndex = COEFFICIENT_B[0] * BLOCK_SIZE + COEFFICIENT_B[1];
    const thirdCoefficientIndex = COEFFICIENT_C[0] * BLOCK_SIZE + COEFFICIENT_C[1];
    const fourthCoefficientIndex = COEFFICIENT_D[0] * BLOCK_SIZE + COEFFICIENT_D[1];
    const differenceKernel = (first, second) => Array.from({ length: BLOCK_SIZE * BLOCK_SIZE }, (_, index) => {
        const x = index % BLOCK_SIZE;
        const y = Math.floor(index / BLOCK_SIZE);
        const coefficient = (u, v) => 0.25 * NORMALIZATION[u] * NORMALIZATION[v]
            * COSINES[u][x] * COSINES[v][y];
        return coefficient(first[0], first[1]) - coefficient(second[0], second[1]);
    });
    const FIRST_DIFFERENCE_KERNEL = differenceKernel(COEFFICIENT_A, COEFFICIENT_B);
    const SECOND_DIFFERENCE_KERNEL = differenceKernel(COEFFICIENT_C, COEFFICIENT_D);
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

    function coefficientDifference(values, kernel = FIRST_DIFFERENCE_KERNEL) {
        let difference = 0;
        for (let index = 0; index < values.length; index += 1) difference += values[index] * kernel[index];
        return difference;
    }

    function appendUint32(target, value) {
        target.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
    }

    function appendString(target, value) {
        if (!textEncoder) throw new Error('当前浏览器不支持 UTF-8 水印编码');
        const bytes = textEncoder.encode(String(value || ''));
        if (bytes.length > 255) throw new Error('水印字段过长');
        target.push(bytes.length, ...bytes);
    }

    function appendHex(target, value, byteLength) {
        const normalized = String(value || '').replace(/[^0-9a-f]/gi, '').padEnd(byteLength * 2, '0');
        for (let index = 0; index < byteLength; index += 1) {
            target.push(Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16) || 0);
        }
    }

    function readUint32FromBytes(source, state) {
        if (state.offset + 4 > source.length) return null;
        const value = (((source[state.offset] << 24) >>> 0)
            | (source[state.offset + 1] << 16)
            | (source[state.offset + 2] << 8)
            | source[state.offset + 3]) >>> 0;
        state.offset += 4;
        return value;
    }

    function readString(source, state) {
        if (!textDecoder || state.offset >= source.length) return null;
        const length = source[state.offset++];
        if (state.offset + length > source.length) return null;
        const value = textDecoder.decode(source.slice(state.offset, state.offset + length));
        state.offset += length;
        return value;
    }

    function readHex(source, state, byteLength) {
        if (state.offset + byteLength > source.length) return null;
        const value = Array.from(source.slice(state.offset, state.offset + byteLength), byte => byte.toString(16).padStart(2, '0')).join('');
        state.offset += byteLength;
        return value;
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

    function fastBlockSymbol(imageData, x, y) {
        let sum = 0;
        let firstDifference = 0;
        let secondDifference = 0;
        let offset = 0;
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
                sum += value;
                firstDifference += value * FIRST_DIFFERENCE_KERNEL[offset];
                secondDifference += value * SECOND_DIFFERENCE_KERNEL[offset];
                offset += 1;
            }
        }
        const mean = sum / (BLOCK_SIZE * BLOCK_SIZE);
        if (mean <= MIN_MEAN_LUMINANCE || mean >= MAX_MEAN_LUMINANCE) return -1;
        if (!eligible) return -1;
        return (coefficientBit(firstDifference) << 1) | coefficientBit(secondDifference);
    }

    function fastBlockEligible(imageData, x, y) {
        let sum = 0;
        for (let row = 0; row < BLOCK_SIZE; row += 1) {
            for (let column = 0; column < BLOCK_SIZE; column += 1) {
                const pixel = ((y + row) * imageData.width + x + column) * 4;
                if (imageData.data[pixel + 3] < MIN_ALPHA) return false;
                sum += luminance(imageData.data[pixel], imageData.data[pixel + 1], imageData.data[pixel + 2]);
            }
        }
        const mean = sum / (BLOCK_SIZE * BLOCK_SIZE);
        return mean > MIN_MEAN_LUMINANCE && mean < MAX_MEAN_LUMINANCE;
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

    function encodePayload(value, sourceIds, optionalFields) {
        const payload = [PAYLOAD_SCHEMA];
        appendUint32(payload, Number(value.t) || 0);
        payload.push(Number(value.l) || 0, Number(value.n) || 0);
        appendString(payload, value.c);
        appendString(payload, value.g);
        payload.push(sourceIds.length);
        sourceIds.forEach(item => appendString(payload, item));
        appendString(payload, value.q);
        const optionalFieldOrder = ['b', 'z', 'd', 'a', 'u', 'h', 'e', 'r'];
        const flags = optionalFieldOrder.reduce((result, key, index) => result | (optionalFields.includes(key) ? (1 << index) : 0), 0);
        payload.push(flags);
        optionalFields.forEach(key => {
            if (key === 'h') appendHex(payload, value[key], 4);
            else if (key === 'e') appendHex(payload, value[key], 4);
            else if (key === 'r') appendHex(payload, value[key], 8);
            else {
                const stringValue = key === 'u' ? Array.from(String(value[key] || '')).slice(0, 32).join('') : value[key];
                appendString(payload, stringValue);
            }
        });
        return Uint8Array.from(payload);
    }

    function payloadFor(metadata, maxPayloadBytes = Number.POSITIVE_INFINITY) {
        const value = metadata || {};
        const sourceIds = Array.isArray(value.s) ? value.s.map(item => String(item || '')).filter(Boolean).slice(0, 255) : [];
        const optionalFields = ['b', 'z', 'd', 'a', 'u', 'h', 'e', 'r'];
        const presentOptionalFields = optionalFields.filter(key => value[key]);
        const fullPayload = encodePayload(value, sourceIds, presentOptionalFields);
        if (fullPayload.length <= maxPayloadBytes) return fullPayload;

        // User, device, edit-hash, and random identifiers are optional fingerprints.
        // Keep every gameplay and template locator when the tile needs to be compacted.
        const fingerprintFields = new Set(['u', 'h', 'e', 'r']);
        const compactPayload = encodePayload(
            value,
            sourceIds,
            presentOptionalFields.filter(key => !fingerprintFields.has(key))
        );
        if (compactPayload.length <= maxPayloadBytes) return compactPayload;
        return compactPayload;
    }

    function decodePayload(payload) {
        if (payload[0] !== PAYLOAD_SCHEMA) return null;
        const state = { offset: 1 };
        const timestamp = readUint32FromBytes(payload, state);
        if (timestamp === null || state.offset + 2 > payload.length) return null;
        const level = payload[state.offset++];
        const nodeLevel = payload[state.offset++];
        const characterId = readString(payload, state);
        const groupId = readString(payload, state);
        if (characterId === null || groupId === null || state.offset >= payload.length) return null;
        const sourceCount = payload[state.offset++];
        const sourceIds = [];
        for (let index = 0; index < sourceCount; index += 1) {
            const sourceId = readString(payload, state);
            if (sourceId === null) return null;
            sourceIds.push(sourceId);
        }
        const selectedSourceId = readString(payload, state);
        if (selectedSourceId === null || state.offset >= payload.length) return null;
        const flags = payload[state.offset++];
        const metadata = {
            v: 1,
            m: 'skill-popup',
            t: timestamp,
            c: characterId,
            g: groupId,
            s: sourceIds,
            q: selectedSourceId,
            l: level,
            n: nodeLevel
        };
        const optionalFields = ['b', 'z', 'd', 'a', 'u', 'h', 'e', 'r'];
        for (let index = 0; index < optionalFields.length; index += 1) {
            if (!(flags & (1 << index))) continue;
            const key = optionalFields[index];
            const value = key === 'h'
                ? readHex(payload, state, 4)
                : key === 'e'
                    ? readHex(payload, state, 4)
                    : key === 'r'
                        ? readHex(payload, state, 8)
                        : readString(payload, state);
            if (value === null) return null;
            metadata[key] = value;
        }
        return state.offset === payload.length ? metadata : null;
    }

    function packetFor(metadata, maxPayloadBytes) {
        const payload = payloadFor(metadata, maxPayloadBytes);
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

    function hammingEncodeNibble(value) {
        const d1 = (value >>> 3) & 1;
        const d2 = (value >>> 2) & 1;
        const d3 = (value >>> 1) & 1;
        const d4 = value & 1;
        return [
            d1 ^ d2 ^ d4,
            d1 ^ d3 ^ d4,
            d1,
            d2 ^ d3 ^ d4,
            d2,
            d3,
            d4
        ];
    }

    function hammingEncodeBytes(bytes) {
        const bits = [];
        bytes.forEach(byte => {
            bits.push(...hammingEncodeNibble(byte >>> 4), ...hammingEncodeNibble(byte & 0x0f));
        });
        return bits;
    }

    function hammingDecodeBits(bits, byteCount) {
        const required = byteCount * 14;
        if (bits.length < required) return null;
        const bytes = new Uint8Array(byteCount);
        let offset = 0;
        const decodeNibble = () => {
            const code = bits.slice(offset, offset + 7);
            offset += 7;
            const syndrome = (code[0] ^ code[2] ^ code[4] ^ code[6])
                | ((code[1] ^ code[2] ^ code[5] ^ code[6]) << 1)
                | ((code[3] ^ code[4] ^ code[5] ^ code[6]) << 2);
            if (syndrome >= 1 && syndrome <= 7) code[syndrome - 1] ^= 1;
            return (code[2] << 3) | (code[4] << 2) | (code[5] << 1) | code[6];
        };
        for (let index = 0; index < byteCount; index += 1) {
            bytes[index] = (decodeNibble() << 4) | decodeNibble();
        }
        return bytes;
    }

    function tilePreambleBits() {
        const pattern = bytesToBits(Uint8Array.from([...MAGIC, VERSION]));
        return Array.from({ length: PREAMBLE_REPETITIONS }, () => pattern).flat();
    }

    function bitsToSymbols(bits) {
        const symbols = [];
        for (let index = 0; index < bits.length; index += 2) {
            symbols.push((bits[index] << 1) | (bits[index + 1] || 0));
        }
        return symbols;
    }

    function symbolsToBits(symbols) {
        const bits = [];
        symbols.forEach(symbol => bits.push((symbol >>> 1) & 1, symbol & 1));
        return bits;
    }

    function tileSymbolsFor(packet) {
        return bitsToSymbols([...tilePreambleBits(), ...hammingEncodeBytes(packet)]);
    }

    function coefficientBit(difference) {
        const index = Math.round(difference / QUANTIZATION_STEP);
        return ((index % 2) + 2) % 2;
    }

    function adjustCoefficientBit(coefficients, firstIndex, secondIndex, difference, bit) {
        if (coefficientBit(difference) === bit) return false;
        const currentIndex = Math.round(difference / QUANTIZATION_STEP);
        const lowerTarget = (currentIndex - 1) * QUANTIZATION_STEP;
        const upperTarget = (currentIndex + 1) * QUANTIZATION_STEP;
        const target = Math.abs(lowerTarget - difference) <= Math.abs(upperTarget - difference)
            ? lowerTarget
            : upperTarget;
        const adjustment = (target - difference) / 2;
        coefficients[firstIndex] += adjustment;
        coefficients[secondIndex] -= adjustment;
        return true;
    }

    function applyBlockValues(imageData, candidate, sourceValues, values) {
        let offset = 0;
        for (let row = 0; row < BLOCK_SIZE; row += 1) {
            for (let column = 0; column < BLOCK_SIZE; column += 1) {
                const pixel = ((candidate.y + row) * imageData.width + candidate.x + column) * 4;
                const delta = values[offset] - sourceValues[offset];
                imageData.data[pixel] = clamp(Math.round(imageData.data[pixel] + delta), 0, 255);
                imageData.data[pixel + 1] = clamp(Math.round(imageData.data[pixel + 1] + delta), 0, 255);
                imageData.data[pixel + 2] = clamp(Math.round(imageData.data[pixel + 2] + delta), 0, 255);
                offset += 1;
            }
        }
    }

    function modifyBlock(imageData, candidate, symbol) {
        const firstBit = (symbol >>> 1) & 1;
        const secondBit = symbol & 1;
        for (let attempt = 0; attempt < 4; attempt += 1) {
            const source = blockData(imageData, candidate.x, candidate.y);
            const coefficients = dct(source.values);
            const firstDifference = coefficients[firstCoefficientIndex] - coefficients[secondCoefficientIndex];
            const secondDifference = coefficients[thirdCoefficientIndex] - coefficients[fourthCoefficientIndex];
            const firstChanged = adjustCoefficientBit(
                coefficients, firstCoefficientIndex, secondCoefficientIndex, firstDifference, firstBit
            );
            const secondChanged = adjustCoefficientBit(
                coefficients, thirdCoefficientIndex, fourthCoefficientIndex, secondDifference, secondBit
            );
            if (!firstChanged && !secondChanged) {
                return fastBlockSymbol(imageData, candidate.x, candidate.y) === symbol;
            }
            const values = inverseDct(coefficients);
            applyBlockValues(imageData, candidate, source.values, values);
            if (fastBlockSymbol(imageData, candidate.x, candidate.y) === symbol) return true;
        }
        return fastBlockSymbol(imageData, candidate.x, candidate.y) === symbol;
    }

    function readBlockSymbol(imageData, candidate) {
        return fastBlockSymbol(imageData, candidate.x, candidate.y);
    }

    function tileMetrics(layout) {
        const columns = layout.width / BLOCK_SIZE;
        const rows = layout.height / BLOCK_SIZE;
        const capacity = columns * rows;
        const maxPacketBytes = Math.floor((capacity - TILE_PREAMBLE_SYMBOLS) / 7);
        return {
            columns,
            rows,
            capacity,
            maxPayloadBytes: maxPacketBytes - HEADER_SIZE
        };
    }

    function tileCandidatesAt(imageData, x, y, layout) {
        const metrics = tileMetrics(layout);
        if (x < 0 || y < 0 || x + layout.width > imageData.width || y + layout.height > imageData.height) return null;
        const candidates = [];
        for (let row = 0; row < metrics.rows; row += 1) {
            for (let column = 0; column < metrics.columns; column += 1) {
                const candidate = { x: x + column * BLOCK_SIZE, y: y + row * BLOCK_SIZE };
                if (!fastBlockEligible(imageData, candidate.x, candidate.y)) return null;
                candidates.push(candidate);
            }
        }
        return candidates;
    }

    function matchesTilePreamble(bits, symbolsPerCopy = tilePreambleBits().length / 2) {
        const pattern = bytesToBits(Uint8Array.from([...MAGIC, VERSION]));
        const bitsPerCopy = Math.min(pattern.length, symbolsPerCopy * 2);
        if (bits.length < bitsPerCopy * PREAMBLE_REPETITIONS) return false;
        for (let index = 0; index < bitsPerCopy; index += 1) {
            if (bits[index] !== pattern[index] && bits[index + bitsPerCopy] !== pattern[index]) return false;
        }
        return true;
    }

    function decodePacketBytes(packet) {
        if (!packet || packet.length < HEADER_SIZE) return null;
        if (!MAGIC.every((value, index) => packet[index] === value) || packet[4] !== VERSION) return null;
        const payloadLength = (packet[5] << 8) | packet[6];
        if (payloadLength > MAX_PAYLOAD_BYTES || packet.length < HEADER_SIZE + payloadLength) return null;
        const payload = packet.slice(HEADER_SIZE, HEADER_SIZE + payloadLength);
        if (crc32(payload) !== readUint32(packet, 7)) return null;
        return decodePayload(payload);
    }

    function decodeTileBits(bits) {
        const preamble = tilePreambleBits();
        if (!matchesTilePreamble(bits)) return null;
        const packetStart = preamble.length;
        const minimumPacketBits = HEADER_SIZE * 14;
        const header = hammingDecodeBits(bits.slice(packetStart, packetStart + minimumPacketBits), HEADER_SIZE);
        if (!header) return null;
        const payloadLength = (header[5] << 8) | header[6];
        if (payloadLength > MAX_PAYLOAD_BYTES) return null;
        const packetBits = (HEADER_SIZE + payloadLength) * 14;
        if (packetStart + packetBits > bits.length) return null;
        const packet = hammingDecodeBits(bits.slice(packetStart, packetStart + packetBits), HEADER_SIZE + payloadLength);
        return decodePacketBytes(packet);
    }

    function readTilePacket(imageData, x, y, layout, precheck = false) {
        const preamble = tilePreambleBits();
        const preambleSymbols = preamble.length / 2;
        const metrics = tileMetrics(layout);
        if (precheck) {
            const quickBits = new Array(PRECHECK_SYMBOLS_PER_COPY * 4);
            for (let copy = 0; copy < PREAMBLE_REPETITIONS; copy += 1) {
                for (let index = 0; index < PRECHECK_SYMBOLS_PER_COPY; index += 1) {
                    const tileIndex = copy * preambleSymbols + index;
                    const candidate = { x: x + (tileIndex % metrics.columns) * BLOCK_SIZE, y: y + Math.floor(tileIndex / metrics.columns) * BLOCK_SIZE };
                    const symbol = readBlockSymbol(imageData, candidate);
                    if (symbol < 0) return null;
                    const bitOffset = (copy * PRECHECK_SYMBOLS_PER_COPY + index) * 2;
                    quickBits[bitOffset] = (symbol >>> 1) & 1;
                    quickBits[bitOffset + 1] = symbol & 1;
                }
            }
            if (!matchesTilePreamble(quickBits, PRECHECK_SYMBOLS_PER_COPY)) return null;
        }
        const symbols = [];
        for (let row = 0; row < metrics.rows; row += 1) {
            for (let column = 0; column < metrics.columns; column += 1) {
                const symbol = readBlockSymbol(imageData, x + column * BLOCK_SIZE, y + row * BLOCK_SIZE);
                if (symbol < 0) return null;
                symbols.push(symbol);
            }
        }
        const bits = symbolsToBits(symbols);
        return decodeTileBits(bits);
    }

    function centerFirstPositions(max, preferred, step = 1) {
        if (max < 0) return [];
        const maxIndex = Math.floor(max / step);
        const preferredIndex = clamp(Math.round(preferred / step), 0, maxIndex);
        const positions = [preferredIndex * step];
        for (let distance = 1; positions.length <= maxIndex; distance += 1) {
            const left = preferredIndex - distance;
            const right = preferredIndex + distance;
            if (left >= 0) positions.push(left * step);
            if (right <= maxIndex) positions.push(right * step);
        }
        return positions;
    }

    function centerFirstOffsets(negativeLimit, positiveLimit) {
        const offsets = [0];
        for (let distance = 1; distance <= Math.max(negativeLimit, positiveLimit); distance += 1) {
            if (distance <= negativeLimit) offsets.push(-distance);
            if (distance <= positiveLimit) offsets.push(distance);
        }
        return offsets;
    }

    function firstEligibleTile(imageData, layout) {
        const maxX = imageData.width - layout.width;
        const maxY = imageData.height - layout.height;
        const xPositions = centerFirstPositions(maxX, maxX / 2, BLOCK_SIZE);
        const yPositions = centerFirstPositions(maxY, maxY / 2, BLOCK_SIZE);
        for (const y of yPositions) {
            for (const x of xPositions) {
                const candidates = tileCandidatesAt(imageData, x, y, layout);
                if (candidates) return { x, y, candidates };
            }
        }
        return null;
    }

    function collectEmbeddingTiles(imageData, layout, anchor) {
        const maxX = imageData.width - layout.width;
        const maxY = imageData.height - layout.height;
        const xOffsets = centerFirstOffsets(
            Math.floor(anchor.x / layout.width),
            Math.floor((maxX - anchor.x) / layout.width)
        );
        const yOffsets = centerFirstOffsets(
            Math.floor(anchor.y / layout.height),
            Math.floor((maxY - anchor.y) / layout.height)
        );
        const tiles = [];
        for (const yOffset of yOffsets) {
            for (const xOffset of xOffsets) {
                const x = anchor.x + xOffset * layout.width;
                const y = anchor.y + yOffset * layout.height;
                const candidates = tileCandidatesAt(imageData, x, y, layout);
                if (!candidates) continue;
                tiles.push(candidates);
                if (tiles.length >= MAX_EMBED_TILES) return tiles;
            }
        }
        return tiles;
    }

    function findEmbeddingPlan(imageData, metadata) {
        if (!imageData?.data || !imageData.width || !imageData.height) {
            return { ok: false, reason: 'invalid-image-data', imageData };
        }
        let capacityFailure = null;
        for (const layout of TILE_LAYOUTS) {
            const metrics = tileMetrics(layout);
            const packet = packetFor(metadata, metrics.maxPayloadBytes);
            const symbols = tileSymbolsFor(packet);
            if (symbols.length > metrics.capacity) {
                capacityFailure = { required: symbols.length, available: metrics.capacity };
                continue;
            }
            const anchor = firstEligibleTile(imageData, layout);
            if (!anchor) continue;
            const tiles = collectEmbeddingTiles(imageData, layout, anchor);
            if (!tiles.length) continue;
            return { ok: true, imageData, packet, symbols, tiles, anchor, layout };
        }
        if (capacityFailure) {
            return { ok: false, reason: 'tile-capacity', imageData, ...capacityFailure };
        }
        return { ok: false, reason: 'no-opaque-tile', imageData };
    }

    function verifyTileSymbols(imageData, candidates, symbols) {
        for (let index = 0; index < symbols.length; index += 1) {
            if (readBlockSymbol(imageData, candidates[index]) !== symbols[index]) return false;
        }
        return true;
    }

    function embed(imageData, metadata) {
        const plan = findEmbeddingPlan(imageData, metadata);
        if (!plan.ok) return plan;
        for (const candidates of plan.tiles) {
            for (let index = 0; index < plan.symbols.length; index += 1) {
                if (!modifyBlock(imageData, candidates[index], plan.symbols[index])) {
                    return { ok: false, reason: 'quantization-failed', imageData, index };
                }
            }
        }
        if (!verifyTileSymbols(imageData, plan.tiles[0], plan.symbols)) {
            return { ok: false, reason: 'verification-failed', imageData };
        }
        return { ok: true, imageData, bytes: plan.packet.length, blocks: plan.symbols.length * plan.tiles.length, tiles: plan.tiles.length, layout: plan.layout };
    }

    async function embedAsync(imageData, metadata) {
        const plan = findEmbeddingPlan(imageData, metadata);
        if (!plan.ok) return plan;
        let written = 0;
        for (const candidates of plan.tiles) {
            for (let index = 0; index < plan.symbols.length; index += 1) {
                if (!modifyBlock(imageData, candidates[index], plan.symbols[index])) {
                    return { ok: false, reason: 'quantization-failed', imageData, index };
                }
                written += 1;
                if ((written & 31) === 0) await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        if (!verifyTileSymbols(imageData, plan.tiles[0], plan.symbols)) {
            return { ok: false, reason: 'verification-failed', imageData };
        }
        return { ok: true, imageData, bytes: plan.packet.length, blocks: plan.symbols.length * plan.tiles.length, tiles: plan.tiles.length, layout: plan.layout };
    }

    function decode(imageData) {
        if (!imageData?.data || !imageData.width || !imageData.height) {
            return { ok: false, reason: 'invalid-image-data' };
        }
        const layouts = TILE_LAYOUTS
            .filter(layout => imageData.width >= layout.width && imageData.height >= layout.height)
            .sort((left, right) => (right.width * right.height) - (left.width * left.height));
        for (const layout of layouts) {
            const maxX = imageData.width - layout.width;
            const maxY = imageData.height - layout.height;
            const xPositions = centerFirstPositions(maxX, maxX / 2);
            const yPositions = centerFirstPositions(maxY, maxY / 2);
            for (const y of yPositions) {
                for (const x of xPositions) {
                    const metadata = readTilePacket(imageData, x, y, layout, true);
                    if (metadata) return { ok: true, metadata, x, y, layout };
                }
            }
        }
        return { ok: false, reason: 'not-found' };
    }

    async function decodeAsync(imageData) {
        if (!imageData?.data || !imageData.width || !imageData.height) {
            return { ok: false, reason: 'invalid-image-data' };
        }
        const layouts = TILE_LAYOUTS
            .filter(layout => imageData.width >= layout.width && imageData.height >= layout.height)
            .sort((left, right) => (right.width * right.height) - (left.width * left.height));
        let scanned = 0;
        for (const layout of layouts) {
            const maxX = imageData.width - layout.width;
            const maxY = imageData.height - layout.height;
            const xPositions = centerFirstPositions(maxX, maxX / 2);
            const yPositions = centerFirstPositions(maxY, maxY / 2);
            for (const y of yPositions) {
                for (const x of xPositions) {
                    const metadata = readTilePacket(imageData, x, y, layout, true);
                    if (metadata) return { ok: true, metadata, x, y, layout };
                    scanned += 1;
                    if ((scanned & 255) === 0) await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        }
        return { ok: false, reason: 'not-found' };
    }

    window.AKEWatermark = Object.freeze({
        version: VERSION,
        hashText,
        randomId,
        embed,
        decode,
        decodeAsync,
        embedAsync
    });
})();
