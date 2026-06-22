import { randomUUID } from "node:crypto";

export function createCbeId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}
