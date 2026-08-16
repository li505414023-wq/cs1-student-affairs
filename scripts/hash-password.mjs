/**
 * 共享的密码散列工具（纯 node:crypto，无 .ts 依赖）。
 * seed 脚本跑在服务器纯 node 环境，不能 import lib/security.ts，
 * 故此工具内联与 lib/security.ts 完全一致的 scrypt 格式（scrypt$salt$hex）。
 */
import { randomBytes, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 10) {
    throw new TypeError("密码至少需要 10 个字符");
  }
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${Buffer.from(derived).toString("hex")}`;
}
