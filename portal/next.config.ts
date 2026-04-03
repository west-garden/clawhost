import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["54.46.3.148", "16.163.142.21", "localhost"],
};

export default withNextIntl(nextConfig);
