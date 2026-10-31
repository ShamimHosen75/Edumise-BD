import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy (Step 6.2). Next.js needs inline scripts and styles without
 * per-request nonces (nonces would make every page dynamic). Images, PDF previews and
 * files come from Supabase storage; the contact map is a Google Maps embed.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}`.trim(),
  `object-src 'self' ${supabaseOrigin}`.trim(),
  `media-src 'self' ${supabaseOrigin}`.trim(),
  "frame-src https://www.google.com https://maps.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Enables forbidden() so wrong-role pages answer with a real 403.
  experimental: {
    authInterrupts: true,
    // File uploads are up to 4 MB plus form fields (see src/lib/files.ts).
    serverActions: { bodySizeLimit: "5mb" },
  },
  images: {
    // A local Supabase (127.0.0.1) cannot go through the image optimizer, which refuses
    // private addresses; production Supabase URLs are optimized as usual.
    unoptimized:
      !!supabaseUrl && /\/\/(127\.0\.0\.1|localhost)[:/]/.test(supabaseUrl),
    // Logos and photos come from the Supabase public-media bucket.
    remotePatterns: supabaseUrl
      ? [
          {
            ...urlParts(supabaseUrl),
            pathname: "/storage/v1/object/public/public-media/**",
          },
        ]
      : [],
  },
};

function urlParts(url: string) {
  const u = new URL(url);
  return {
    protocol: u.protocol.replace(":", "") as "http" | "https",
    hostname: u.hostname,
    port: u.port,
  };
}

export default nextConfig;
