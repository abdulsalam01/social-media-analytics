/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@libsql/client", "@libsql/hrana-client"],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};
export default nextConfig;
