import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` would otherwise write an AGENTS.md file whenever it detects an
  // AI coding agent. Detection differs between agent CLIs, so it is disabled
  // to give every benchmarked agent the same starting repository.
  agentRules: false,
  devIndicators: false,
};

export default nextConfig;
