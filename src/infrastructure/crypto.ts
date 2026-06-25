import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Encryption key must be 32 bytes (64 hex characters)
function getEncryptionKey(): Buffer {
  const keyHex = process.env.STELLAR_POOL_SECRET_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('STELLAR_POOL_SECRET_ENCRYPTION_KEY is not defined in environment variables');
  }
  if (keyHex.length !== 64) {
    throw new Error('STELLAR_POOL_SECRET_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

export function encryptSecret(secretText: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12); // GCM standard IV is 12 bytes
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(secretText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

export function decryptSecret(encryptedText: string, ivHex: string, tagHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
