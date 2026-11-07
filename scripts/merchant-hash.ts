/**
 * Prints a scrypt hash for MERCHANT_PASSWORD_HASH.
 * Usage: npm run merchant:hash -- "<password>"
 */
import { hashPassword } from "../src/domain/merchant/credentials";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Usage: npm run merchant:hash -- "<password of at least 12 characters>"');
  process.exit(1);
}
console.log(hashPassword(password));
