/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Desarrollo y producción no deben sobrescribir sus archivos generados.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
