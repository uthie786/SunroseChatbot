/** @type {import('next').NextConfig} */
const nextConfig = {
  // Make sure the knowledge and prompt files are bundled with the webhook on Vercel.
  outputFileTracingIncludes: {
    '/api/chatwoot': ['./knowledge/**/*', './prompts/**/*'],
  },
};

export default nextConfig;
