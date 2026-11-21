import { loadPublicRoadmap } from '../../games/public-roadmap.js';

// Reproduziert für Tests die zwei geprüften Belege des Produktionsstands vom 20.11.2026.
export const production = { version: '3.17.0', commit: 'cb2c16701acfb423173283feddd8030a524cd910' };
const deployments = loadPublicRoadmap().entries
  .filter((entry) => entry.status === 'neu')
  .map(({ internal: { deployment } }) => ({
    implementationCommit: deployment.implementation_commit,
    productionRef: deployment.production_commit,
    productionCommit: production.commit,
    productionVersion: production.version,
  }));

export const buildProofFor = (running) => ({ schemaVersion: 1, ...running, deployments: structuredClone(deployments) });
export const productionProof = buildProofFor(production);
