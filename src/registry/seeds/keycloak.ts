/**
 * Keycloak — identity and access management. OpenID Connect + SAML.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "keycloak",
  label: "Keycloak",
  description: "Open-source identity and access management (OIDC, SAML).",
  emoji: "🔐",
  category: "auth",
  tags: ["auth", "oidc", "saml", "iam"],
  image: "quay.io/keycloak/keycloak",
  official: true,
  externalRegistry: "quay",
  recommended: "25.0",
  latest: "26.0",
  versionSource: "sync",
  compose: {
    ports: [{ host: 8080, container: 8080 }],
    volumes: [],
    env: [
      { key: "KEYCLOAK_ADMIN", value: "admin" },
      { key: "KEYCLOAK_ADMIN_PASSWORD", value: "changeme" },
    ],
    hasHealthcheck: true,
    healthcheckCmd: ["CMD-SHELL", "exec 3<>/dev/tcp/localhost/8080 && echo -e 'GET /health/ready HTTP/1.1\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && grep -q '200 OK' <&3 || exit 1"],
    defaultRestart: "unless-stopped",
    defaultCommand: ["start-dev"],
  },
};
