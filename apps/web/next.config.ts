import type { NextConfig } from "next";

type RemotePattern = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>[number];

function parseUrl(value: string, label: string): URL {
  try {
    const parsed = new URL(value);
    const isLoopback =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]";
    if (
      process.env.NODE_ENV === "production" &&
      parsed.protocol !== "https:" &&
      !isLoopback
    ) {
      throw new Error(
        `${label} must use HTTPS in production unless it targets localhost.`,
      );
    }
    return parsed;
  } catch (cause) {
    throw new Error(`${label} must be a valid absolute URL.`, { cause });
  }
}

function mediaUrl(): URL {
  return parseUrl(
    process.env.NEXT_PUBLIC_CDN_BASE_URL ??
      process.env.CDN_BASE_URL ??
      "http://localhost:9000/bhumiraj-public",
    "NEXT_PUBLIC_CDN_BASE_URL",
  );
}

function remotePattern(url: URL): RemotePattern {
  const prefix = url.pathname.replace(/\/$/, "");
  return {
    protocol: url.protocol === "https:" ? "https" : "http",
    hostname: url.hostname,
    port: url.port,
    pathname: `${prefix || ""}/**`,
  };
}

function contentSecurityPolicy(): string {
  const media = mediaUrl();
  const upload = parseUrl(
    process.env.NEXT_PUBLIC_UPLOAD_ORIGIN ?? "http://localhost:9000",
    "NEXT_PUBLIC_UPLOAD_ORIGIN",
  );
  const mapStyle = parseUrl(
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
      "https://demotiles.maplibre.org/style.json",
    "NEXT_PUBLIC_MAP_STYLE_URL",
  );
  const developmentScript =
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const upgrade =
    process.env.NODE_ENV === "production" ? "upgrade-insecure-requests;" : "";

  return [
    "default-src 'self';",
    `script-src 'self' 'unsafe-inline'${developmentScript};`,
    "style-src 'self' 'unsafe-inline';",
    `img-src 'self' data: blob: ${media.origin} https://lh3.googleusercontent.com https://avatars.githubusercontent.com ${mapStyle.origin};`,
    "font-src 'self' data:;",
    `connect-src 'self' ${upload.origin} ${mapStyle.origin} ws: wss:;`,
    `media-src 'self' blob: ${media.origin};`,
    "object-src 'none';",
    "base-uri 'self';",
    "form-action 'self';",
    "frame-ancestors 'none';",
    "worker-src 'self' blob:;",
    "manifest-src 'self';",
    upgrade,
  ]
    .filter(Boolean)
    .join(" ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(), geolocation=(self), payment=(self), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      remotePattern(mediaUrl()),
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
