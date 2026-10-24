import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Logos and photos come from the Supabase public-media bucket.
    remotePatterns: supabaseUrl
      ? [{ ...urlParts(supabaseUrl), pathname: "/storage/v1/object/public/public-media/**" }]
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
