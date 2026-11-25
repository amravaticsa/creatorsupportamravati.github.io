/* CSA Global API migration switch.
 * Default remains Legacy Staging until route parity, data reconciliation,
 * auth, storage and rollback gates are all signed off.
 */
(function (root) {
  "use strict";
  const LEGACY_API_BASE = "https://csa-global-api-staging.creatorsupportamravati.workers.dev";
  const ISOLATED_API_BASE = "https://csa-global-api-isolated-staging.creatorsupportamravati.workers.dev";
  const config = Object.freeze({
    mode: "legacy",
    activeBaseUrl: LEGACY_API_BASE,
    legacyBaseUrl: LEGACY_API_BASE,
    isolatedBaseUrl: ISOLATED_API_BASE,
    isolatedTrafficEnabled: false,
    rollbackBaseUrl: LEGACY_API_BASE,
    migrationGate: "BLOCKED_UNTIL_HR_ACCESS_AUTHENTICATED_E2E_STORAGE_ROLLBACK_AND_ACCEPTANCE"
  });
  root.CSA_GLOBAL_API_CONFIG = config;
})(window);
