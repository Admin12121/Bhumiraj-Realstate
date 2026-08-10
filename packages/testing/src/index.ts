import * as OTPAuth from "otpauth";
export function currentTotp(secret: string) { return new OTPAuth.TOTP({ issuer: "Bhumiraj Estates", label: "e2e", algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) }).generate(); }
export function uniqueEmail(prefix = "user") { return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.test`; }
