/**
 * MailHog — local SMTP testing for development.
 */
import type { ServiceSeed } from "../types";

export const seed: ServiceSeed = {
  id: "mailhog",
  label: "MailHog",
  description: "Local SMTP server with a web UI for testing emails.",
  emoji: "📬",
  category: "ci-dev",
  tags: ["smtp", "email", "dev", "test"],
  image: "mailhog/mailhog",
  official: true,
  recommended: "v1.0.1",
  latest: "v1.0.1",
  versionSource: "sync",
  compose: {
    ports: [
      { host: 1025, container: 1025 },
      { host: 8025, container: 8025 },
    ],
    volumes: [],
    env: [],
    hasHealthcheck: true,
    healthcheckCmd: ["CMD-SHELL", "wget --spider -q http://localhost:8025/ || exit 1"],
    defaultRestart: "unless-stopped",
  },
};
