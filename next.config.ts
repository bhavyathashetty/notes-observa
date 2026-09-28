import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@ai-sdk/otel",
    "@arizeai/openinference-semantic-conventions",
    "@arizeai/openinference-vercel",
    "@opentelemetry/exporter-trace-otlp-proto",
    "@vercel/otel",
  ],
};

export default nextConfig;
