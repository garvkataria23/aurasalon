import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_COMMENT_LENGTH = 0xffff;

function zipError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizedEntryName(name = "") {
  return String(name || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function assertSafeEntryName(name) {
  const normalized = normalizedEntryName(name);
  if (!normalized || normalized.endsWith("/")) return normalized;
  if (normalized.split("/").some((part) => part === "..")) {
    throw zipError("ZIP archive contains an unsafe file path.");
  }
  return normalized;
}

function findEndOfCentralDirectory(buffer) {
  const start = Math.max(0, buffer.length - MAX_COMMENT_LENGTH - 22);
  for (let offset = buffer.length - 22; offset >= start; offset--) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw zipError("Invalid ZIP archive.");
}

export function extractZipEntries(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw zipError("Invalid ZIP archive.");
  const maxEntries = Math.max(1, Number(options.maxEntries || 50));
  const maxUncompressedBytes = Math.max(1024, Number(options.maxUncompressedBytes || 50 * 1024 * 1024));
  const maxEntryUncompressedBytes = Math.max(1024, Number(options.maxEntryUncompressedBytes || 500 * 1024 * 1024));
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (entryCount > maxEntries) throw zipError(`ZIP archive has too many files. Maximum allowed is ${maxEntries}.`);

  let offset = centralDirectoryOffset;
  let totalUncompressedBytes = 0;
  const entries = [];
  for (let index = 0; index < entryCount; index++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) throw zipError("Invalid ZIP central directory.");
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const name = assertSafeEntryName(buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8"));
    offset = nameStart + fileNameLength + extraLength + commentLength;

    if (!name || name.endsWith("/")) continue;
    if (flags & 0x1) throw zipError("Password-protected ZIP files are not supported.");
    if (![0, 8].includes(method)) throw zipError(`Unsupported ZIP compression method for ${name}.`);
    if (uncompressedSize > maxEntryUncompressedBytes) {
      throw zipError(`ZIP entry "${name}" is too large after extraction (${(uncompressedSize / 1024 / 1024).toFixed(1)} MB). Maximum per-entry is ${Math.round(maxEntryUncompressedBytes / 1024 / 1024)} MB.`);
    }
    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > maxUncompressedBytes) {
      throw zipError("ZIP archive is too large after extraction.");
    }
    if (buffer.readUInt32LE(localHeaderOffset) !== LOCAL_SIGNATURE) throw zipError("Invalid ZIP local header.");
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
    if (data.length !== uncompressedSize) throw zipError(`ZIP entry size mismatch for ${name}.`);
    entries.push({ name, data, uncompressedSize });
  }
  return entries;
}
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let crc = index;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[index] = crc >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    time: (hours << 11) | (minutes << 5) | seconds,
    date: ((year - 1980) << 9) | (month << 5) | day
  };
}

export function createZipArchive(files = []) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  let entryCount = 0;
  const stamp = dosDateTime();

  for (const file of files) {
    const name = assertSafeEntryName(file.name);
    if (!name || name.endsWith("/")) continue;
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(String(file.data ?? ""), "utf8");
    const nameBuffer = Buffer.from(name, "utf8");
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_SIGNATURE, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_SIGNATURE, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + data.length;
    entryCount++;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(EOCD_SIGNATURE, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entryCount, 8);
  end.writeUInt16LE(entryCount, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}
