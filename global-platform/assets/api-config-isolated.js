/* CSA Global isolated staging API switch. Never use this file on production pages. */
(function (root) {
  "use strict";
  const ISOLATED_API_BASE = "https://csa-global-api-isolated-staging.creatorsupportamravati.workers.dev";
  root.CSA_GLOBAL_API_CONFIG = Object.freeze({
    mode: "isolated-staging",
    activeBaseUrl: ISOLATED_API_BASE,
    legacyBaseUrl: "https://csa-global-api-staging.creatorsupportamravati.workers.dev",
    isolatedBaseUrl: ISOLATED_API_BASE,
    isolatedTrafficEnabled: true,
    rollbackBaseUrl: "https://csa-global-api-staging.creatorsupportamravati.workers.dev",
    migrationGate: "ISOLATED_STAGING_ONLY_NOT_PRODUCTION"
  });
})(window);
