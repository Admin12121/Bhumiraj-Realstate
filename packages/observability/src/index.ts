import pino from "pino";

export function createLogger(name: string) {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
        "req.body.password",
        "req.body.currentPassword",
        "req.body.newPassword",
        "req.body.token",
        "req.body.secret",
        "accessToken",
        "refreshToken",
        "*.accessToken",
        "*.refreshToken",
      ],
      censor: "[REDACTED]",
    },
  });
}
