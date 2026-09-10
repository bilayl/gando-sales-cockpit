import { createRemoteJWKSet, jwtVerify } from "jose";

const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_AUDIENCE = "gando-sales-cockpit-hubspot-sync";
const GITHUB_REPOSITORY = "bilayl/gando-sales-cockpit";
const GITHUB_REPOSITORY_ID = "1332978877";
const GITHUB_MAIN_REF = "refs/heads/main";
const GITHUB_SYNC_WORKFLOW_REF = `${GITHUB_REPOSITORY}/.github/workflows/hubspot-sync.yml@${GITHUB_MAIN_REF}`;

const githubActionsJwks = createRemoteJWKSet(
  new URL(`${GITHUB_OIDC_ISSUER}/.well-known/jwks`),
);

export const GITHUB_SYNC_OIDC_AUDIENCE = GITHUB_OIDC_AUDIENCE;

export async function isAuthorizedGitHubSyncToken(token: string) {
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, githubActionsJwks, {
      issuer: GITHUB_OIDC_ISSUER,
      audience: GITHUB_OIDC_AUDIENCE,
    });

    const eventName = typeof payload.event_name === "string" ? payload.event_name : "";

    return (
      payload.repository === GITHUB_REPOSITORY &&
      payload.repository_id === GITHUB_REPOSITORY_ID &&
      payload.ref === GITHUB_MAIN_REF &&
      payload.workflow_ref === GITHUB_SYNC_WORKFLOW_REF &&
      (eventName === "schedule" || eventName === "workflow_dispatch")
    );
  } catch (error) {
    console.warn(
      "GitHub Actions OIDC verification failed:",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}
