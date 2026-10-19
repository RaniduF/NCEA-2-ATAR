// GitHub Pages serves project sites from /<repo>/; the deploy workflow sets this
// from actions/configure-pages. Leave unset for a custom domain or local dev.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
