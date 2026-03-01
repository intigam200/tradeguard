/**
 * Шифрование API-ключей перед сохранением в БД (AES-256-GCM).
 *
 * Если ENCRYPTION_KEY не задан — данные хранятся в открытом виде.
 * Зашифрованные значения начинаются с префикса "ENC:" для обратной совместимости:
 * старые незашифрованные ключи продолжают работать без изменений.
 *
 * Добавьте в .env:
 *   ENCRYPTION_KEY=любая-строка-минимум-16-символов
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const ALGO       = "aes-256-gcm";
const IV_LEN     = 12;   // 96-bit IV — рекомендован для GCM
const TAG_LEN    = 16;   // 128-bit auth tag
const PREFIX     = "ENC:";

// ─── Получить/вычислить 32-байтный ключ ──────────────────────────────────────

function getKey(): Buffer | null {
  const k = process.env.ENCRYPTION_KEY;
  if (!k) return null;

  // Если это 64-символьная hex-строка — использовать напрямую (32 байта)
  if (/^[0-9a-fA-F]{64}$/.test(k)) {
    return Buffer.from(k, "hex");
  }

  // Иначе — производим ключ через scrypt
  return scryptSync(k, "tradeguard-kdf-salt-v1", 32);
}

// ─── Шифрование ──────────────────────────────────────────────────────────────

export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // ENCRYPTION_KEY не задан — хранить как есть

  const iv     = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Формат: PREFIX + base64(iv[12] + tag[16] + ciphertext)
  const combined = Buffer.concat([iv, tag, encrypted]);
  return PREFIX + combined.toString("base64");
}

// ─── Дешифрование ────────────────────────────────────────────────────────────

export function decrypt(ciphertext: string): string {
  // Не зашифровано (старые данные или ENCRYPTION_KEY не был задан)
  if (!ciphertext.startsWith(PREFIX)) return ciphertext;

  const key = getKey();
  if (!key) {
    // Ключ не задан, а данные зашифрованы — вернуть как есть и залогировать
    console.error("[crypto] ENCRYPTION_KEY not set, cannot decrypt value");
    return ciphertext;
  }

  try {
    const combined  = Buffer.from(ciphertext.slice(PREFIX.length), "base64");
    const iv        = combined.subarray(0, IV_LEN);
    const tag       = combined.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const encrypted = combined.subarray(IV_LEN + TAG_LEN);

    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);

    return (
      decipher.update(encrypted).toString("utf8") +
      decipher.final("utf8")
    );
  } catch (err) {
    console.error("[crypto] Decryption failed:", (err as Error).message);
    return ciphertext; // вернуть как есть, чтобы не сломать работу
  }
}
