import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@deeclinic/shared'],
  // Lets a second dev server (for example a design preview) run beside the main one
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Next's dev server writes an AGENTS.md file by default. This project keeps its own docs.
  agentRules: false,
};

export default config;
