// ============================================================================
// CRYPTO MODULE - AES-256 ENCRYPTION & DECRYPTION CHO GOOGLE APPS SCRIPT
// Mã hóa 2 chiều mật khẩu và mã 2FA trước khi lưu vào Google Sheets
// ============================================================================

/**
 * Standard AES S-Box lookup table
 */
const AES_SBOX = [
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5e, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
];

const AES_RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

/**
 * Key expansion cho AES-256 (256-bit key = 32 bytes, 14 rounds -> 60 words)
 */
function aesKeyExpansion(keyBytes: number[]): number[] {
  const w: number[] = new Array(60);
  for (let i = 0; i < 8; i++) {
    w[i] = ((keyBytes[4 * i] & 0xff) << 24) |
           ((keyBytes[4 * i + 1] & 0xff) << 16) |
           ((keyBytes[4 * i + 2] & 0xff) << 8) |
           (keyBytes[4 * i + 3] & 0xff);
  }

  for (let i = 8; i < 60; i++) {
    let temp = w[i - 1];
    if (i % 8 === 0) {
      // RotWord & SubWord
      temp = ((temp << 8) | (temp >>> 24)) >>> 0;
      temp = ((AES_SBOX[(temp >>> 24) & 0xff] << 24) |
              (AES_SBOX[(temp >>> 16) & 0xff] << 16) |
              (AES_SBOX[(temp >>> 8) & 0xff] << 8) |
              AES_SBOX[temp & 0xff]) >>> 0;
      temp = (temp ^ (AES_RCON[i / 8] << 24)) >>> 0;
    } else if (i % 8 === 4) {
      // SubWord
      temp = ((AES_SBOX[(temp >>> 24) & 0xff] << 24) |
              (AES_SBOX[(temp >>> 16) & 0xff] << 16) |
              (AES_SBOX[(temp >>> 8) & 0xff] << 8) |
              AES_SBOX[temp & 0xff]) >>> 0;
    }
    w[i] = (w[i - 8] ^ temp) >>> 0;
  }
  return w;
}

/**
 * AES-256 block cipher encryption for 16-byte block
 */
function aesEncryptBlock(block: number[], roundKeys: number[]): number[] {
  let s0 = ((block[0] & 0xff) << 24) | ((block[1] & 0xff) << 16) | ((block[2] & 0xff) << 8) | (block[3] & 0xff);
  let s1 = ((block[4] & 0xff) << 24) | ((block[5] & 0xff) << 16) | ((block[6] & 0xff) << 8) | (block[7] & 0xff);
  let s2 = ((block[8] & 0xff) << 24) | ((block[9] & 0xff) << 16) | ((block[10] & 0xff) << 8) | (block[11] & 0xff);
  let s3 = ((block[12] & 0xff) << 24) | ((block[13] & 0xff) << 16) | ((block[14] & 0xff) << 8) | (block[15] & 0xff);

  // Initial round
  s0 = (s0 ^ roundKeys[0]) >>> 0;
  s1 = (s1 ^ roundKeys[1]) >>> 0;
  s2 = (s2 ^ roundKeys[2]) >>> 0;
  s3 = (s3 ^ roundKeys[3]) >>> 0;

  function xtime(a: number): number {
    return ((a << 1) ^ (((a >>> 7) & 1) * 0x11b)) & 0xff;
  }

  function mixWord(b0: number, b1: number, b2: number, b3: number): number {
    const d0 = xtime(b0) ^ xtime(b1) ^ b1 ^ b2 ^ b3;
    const d1 = b0 ^ xtime(b1) ^ xtime(b2) ^ b2 ^ b3;
    const d2 = b0 ^ b1 ^ xtime(b2) ^ xtime(b3) ^ b3;
    const d3 = xtime(b0) ^ b0 ^ b1 ^ b2 ^ xtime(b3);
    return ((d0 & 0xff) << 24) | ((d1 & 0xff) << 16) | ((d2 & 0xff) << 8) | (d3 & 0xff);
  }

  // 13 main rounds
  for (let round = 1; round < 14; round++) {
    const b0 = AES_SBOX[(s0 >>> 24) & 0xff];
    const b1 = AES_SBOX[(s1 >>> 16) & 0xff];
    const b2 = AES_SBOX[(s2 >>> 8) & 0xff];
    const b3 = AES_SBOX[s3 & 0xff];

    const b4 = AES_SBOX[(s1 >>> 24) & 0xff];
    const b5 = AES_SBOX[(s2 >>> 16) & 0xff];
    const b6 = AES_SBOX[(s3 >>> 8) & 0xff];
    const b7 = AES_SBOX[s0 & 0xff];

    const b8 = AES_SBOX[(s2 >>> 24) & 0xff];
    const b9 = AES_SBOX[(s3 >>> 16) & 0xff];
    const b10 = AES_SBOX[(s0 >>> 8) & 0xff];
    const b11 = AES_SBOX[s1 & 0xff];

    const b12 = AES_SBOX[(s3 >>> 24) & 0xff];
    const b13 = AES_SBOX[(s0 >>> 16) & 0xff];
    const b14 = AES_SBOX[(s1 >>> 8) & 0xff];
    const b15 = AES_SBOX[s2 & 0xff];

    s0 = (mixWord(b0, b1, b2, b3) ^ roundKeys[round * 4]) >>> 0;
    s1 = (mixWord(b4, b5, b6, b7) ^ roundKeys[round * 4 + 1]) >>> 0;
    s2 = (mixWord(b8, b9, b10, b11) ^ roundKeys[round * 4 + 2]) >>> 0;
    s3 = (mixWord(b12, b13, b14, b15) ^ roundKeys[round * 4 + 3]) >>> 0;
  }

  // Final round (không MixColumns)
  const f0 = AES_SBOX[(s0 >>> 24) & 0xff];
  const f1 = AES_SBOX[(s1 >>> 16) & 0xff];
  const f2 = AES_SBOX[(s2 >>> 8) & 0xff];
  const f3 = AES_SBOX[s3 & 0xff];

  const f4 = AES_SBOX[(s1 >>> 24) & 0xff];
  const f5 = AES_SBOX[(s2 >>> 16) & 0xff];
  const f6 = AES_SBOX[(s3 >>> 8) & 0xff];
  const f7 = AES_SBOX[s0 & 0xff];

  const f8 = AES_SBOX[(s2 >>> 24) & 0xff];
  const f9 = AES_SBOX[(s3 >>> 16) & 0xff];
  const f10 = AES_SBOX[(s0 >>> 8) & 0xff];
  const f11 = AES_SBOX[s1 & 0xff];

  const f12 = AES_SBOX[(s3 >>> 24) & 0xff];
  const f13 = AES_SBOX[(s0 >>> 16) & 0xff];
  const f14 = AES_SBOX[(s1 >>> 8) & 0xff];
  const f15 = AES_SBOX[s2 & 0xff];

  s0 = (((f0 << 24) | (f1 << 16) | (f2 << 8) | f3) ^ roundKeys[56]) >>> 0;
  s1 = (((f4 << 24) | (f5 << 16) | (f6 << 8) | f7) ^ roundKeys[57]) >>> 0;
  s2 = (((f8 << 24) | (f9 << 16) | (f10 << 8) | f11) ^ roundKeys[58]) >>> 0;
  s3 = (((f12 << 24) | (f13 << 16) | (f14 << 8) | f15) ^ roundKeys[59]) >>> 0;

  return [
    (s0 >>> 24) & 0xff, (s0 >>> 16) & 0xff, (s0 >>> 8) & 0xff, s0 & 0xff,
    (s1 >>> 24) & 0xff, (s1 >>> 16) & 0xff, (s1 >>> 8) & 0xff, s1 & 0xff,
    (s2 >>> 24) & 0xff, (s2 >>> 16) & 0xff, (s2 >>> 8) & 0xff, s2 & 0xff,
    (s3 >>> 24) & 0xff, (s3 >>> 16) & 0xff, (s3 >>> 8) & 0xff, s3 & 0xff
  ];
}

/**
 * Tạo 32-byte key từ chuỗi bí mật bất kỳ bằng SHA-256
 */
function deriveKey256(secret: string): number[] {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, secret, Utilities.Charset.UTF_8);
  const key: number[] = [];
  for (let i = 0; i < digest.length; i++) {
    key.push(digest[i] < 0 ? digest[i] + 256 : digest[i]);
  }
  return key;
}

/**
 * Chuyển chuỗi UTF-8 sang mảng byte
 */
function stringToUtf8Bytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charCode = str.charCodeAt(i);
    if (charCode < 0x80) {
      bytes.push(charCode);
    } else if (charCode < 0x800) {
      bytes.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else if (charCode < 0xd800 || charCode >= 0xe000) {
      bytes.push(0xe0 | (charCode >> 12), 0x80 | ((charCode >> 6) & 0x3f), 0x80 | (charCode & 0x3f));
    } else {
      // surrogate pair
      i++;
      charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (charCode >> 18),
        0x80 | ((charCode >> 12) & 0x3f),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    }
  }
  return bytes;
}

/**
 * Chuyển mảng byte UTF-8 sang chuỗi
 */
function utf8BytesToString(bytes: number[]): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i++];
    if (c < 0x80) {
      out += String.fromCharCode(c);
    } else if (c > 0xbf && c < 0xe0) {
      const c2 = bytes[i++];
      out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
    } else if (c > 0xdf && c < 0xf0) {
      const c2 = bytes[i++];
      const c3 = bytes[i++];
      out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
    } else {
      const c2 = bytes[i++];
      const c3 = bytes[i++];
      const c4 = bytes[i++];
      let u = (((c & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f)) - 0x10000;
      out += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
    }
  }
  return out;
}

const ENC_PREFIX = 'ENC::';

/**
 * Hàm mã hóa chuỗi (Lưu trực tiếp dạng Plain Text theo yêu cầu người dùng)
 * @param plainText Chuỗi mật khẩu, 2fa, ...
 * @param customKey Secret key tùy chọn (không bắt buộc)
 */
function encrypt(plainText: string, customKey?: string): string {
  if (!plainText || typeof plainText !== 'string') {
    return '';
  }
  // Lưu trực tiếp dạng plain text (không mã hóa)
  return plainText;
}

/**
 * Hàm giải mã chuỗi mã hóa AES-256 (CTR Mode)
 * @param cipherText Chuỗi đã mã hóa
 * @param customKey Secret key tùy chọn
 */
function decrypt(cipherText: string, customKey?: string): string {
  if (!cipherText || typeof cipherText !== 'string') {
    return '';
  }

  // Nếu không có tiền tố ENC::, có thể là dữ liệu cũ chưa mã hóa
  if (!cipherText.startsWith(ENC_PREFIX)) {
    return cipherText;
  }

  const rawBase64 = cipherText.substring(ENC_PREFIX.length);
  const keyString = customKey || getSystemConfig().encryptionKey;
  if (!keyString) {
    return cipherText;
  }

  try {
    const signedBytes = Utilities.base64Decode(rawBase64);
    const combined: number[] = signedBytes.map((b: number) => (b < 0 ? b + 256 : b));

    if (combined.length < 16) {
      return cipherText;
    }

    const iv = combined.slice(0, 16);
    const cipherBytes = combined.slice(16);

    const keyBytes = deriveKey256(keyString);
    const roundKeys = aesKeyExpansion(keyBytes);

    const plainBytes: number[] = [];
    const counterBlock = [...iv];
    let blockIndex = 0;

    while (blockIndex < cipherBytes.length) {
      const keystream = aesEncryptBlock(counterBlock, roundKeys);
      const chunkSize = Math.min(16, cipherBytes.length - blockIndex);

      for (let i = 0; i < chunkSize; i++) {
        plainBytes.push(cipherBytes[blockIndex + i] ^ keystream[i]);
      }

      blockIndex += chunkSize;

      for (let c = 15; c >= 0; c--) {
        counterBlock[c] = (counterBlock[c] + 1) & 0xff;
        if (counterBlock[c] !== 0) break;
      }
    }

    return utf8BytesToString(plainBytes);
  } catch (err) {
    console.error('Lỗi khi giải mã:', err);
    return cipherText;
  }
}
