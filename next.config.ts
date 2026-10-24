import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Enables forbidden() so wrong-role pages answer with a real 403.
  experimental: {
    authInterrupts: true,
    // Logo uploads are up to 1 MB plus form fields.
    serverActions: { bodySizeLimit: "2mb" },
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
