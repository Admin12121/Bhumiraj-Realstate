import { BadRequestException } from "@nestjs/common";
import type { z } from "zod";

export type ListingCursor = { publishedAt: string; id: string };

const MAX_CURSOR_BYTES = 1024;

export function encodeCursor<T extends object>(value: T): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeCursor<T extends object>(value: string | undefined, schema?: z.ZodType<T>): T | undefined {
  if (!value) return undefined;
  if (value.length > MAX_CURSOR_BYTES) throw invalidCursor();

  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    if (!json || Buffer.byteLength(json, "utf8") > MAX_CURSOR_BYTES) {
      throw invalidCursor();
    }
    const raw: unknown = JSON.parse(json);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalidCursor();
    if (!schema) return raw as T;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw invalidCursor();
    return parsed.data;
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw invalidCursor();
  }
}

function invalidCursor() {
  return new BadRequestException({
    code: "INVALID_CURSOR",
    message: "The pagination cursor is invalid or expired.",
  });
}
