/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hostinger can briefly serve an older browser bundle alongside a newer
  // server deployment. A per-deployment ID makes Next.js hard-reload instead
  // of sending an old Server Action to a newer server.
  ...(process.env.NEXT_DEPLOYMENT_ID ? { deploymentId: process.env.NEXT_DEPLOYMENT_ID } : {}),
  images: {
    // Serve images directly to avoid routing every photo through the Next
    // image optimizer on Hostinger. Keep Cloudinary allowed only for older
    // booking records until their reference images have been migrated.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
