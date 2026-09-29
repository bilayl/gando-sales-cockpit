import "server-only";

import { createHash } from "node:crypto";
import { CompactEncrypt, compactDecrypt } from "jose";
import { cookies } from "next/headers";

const CONNECTION_COOKIE = "gando_developer_docs_github";
const CONNECTION_MAX_AGE = 60 * 60 * 24 * 90;
const DEFAULT_OWNER = "bilayl";
const DEFAULT_REPO = "gando-app";
const DEFAULT_BRANCH = "master";
const DEFAULT_BASE_PATH = "docs/developer-portal";

export type DeveloperDocStatus = "draft" | "published";

export type DeveloperDocPage = {
  id: string;
  path: string;
  sha: string;
  title: string;
  slug: string;
  section: string;
  description: string;
  body: string;
  status: DeveloperDocStatus;
  order: number;
  updatedAt: string | null;
};

export type DeveloperDocsConnection = {
  owner: string;
  repo: string;
  branch: string;
  basePath: string;
  token?: string;
  tokenSource: "server" | "browser" | "none";
};

type StoredConnection = {
  owner: string;
  repo: string;
  branch: string;
  basePath: string;
  token?: string;
  issuedAt: number;
};

type GithubTreeResponse = {
  tree?: Array<{
    path?: string;
    type?: "blob" | "tree";
    sha?: string;
    size?: number;
  }>;
  truncated?: boolean;
};

type GithubContentsFile = {
  type?: "file";
  path?: string;
  sha?: string;
  content?: string;
  encoding?: string;
};

type GithubRepo = {
  html_url?: string;
  private?: boolean;
  default_branch?: string;
  permissions?: {
    pull?: boolean;
    push?: boolean;
    admin?: boolean;
    maintain?: boolean;
  };
};

type GithubBranch = {
  name?: string;
  protected?: boolean;
};

export class DeveloperDocsGithubError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "DeveloperDocsGithubError";
    this.status = status;
  }
}

function connectionKey() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) throw new DeveloperDocsGithubError("SESSION_SECRET manquant", 500);
  return createHash("sha256").update(secret).digest();
}

function cleanRepoSegment(value: string, fallback: string) {
  const normalized = value.trim();
  if (!normalized) return fallback;
  if (!/^[A-Za-z0-9_.-]+$/.test(normalized)) {
    throw new DeveloperDocsGithubError("Nom de dépôt GitHub invalide.", 400);
  }
  return normalized;
}

function cleanBranch(value: string, fallback: string) {
  const normalized = value.trim() || fallback;
  if (
    normalized.length > 180
    || normalized.startsWith("/")
    || normalized.endsWith("/")
    || normalized.includes("..")
    || !/^[A-Za-z0-9._/-]+$/.test(normalized)
  ) {
    throw new DeveloperDocsGithubError("Branche GitHub invalide.", 400);
  }
  return normalized;
}

function cleanBasePath(value: string, fallback: string) {
  const normalized = value.trim().replace(/^\/+|\/+$/g, "") || fallback;
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.some(part => part === "." || part === "..")) {
    throw new DeveloperDocsGithubError("Dossier de documentation invalide.", 400);
  }
  if (!parts.every(part => /^[A-Za-z0-9_.() -]+$/.test(part))) {
    throw new DeveloperDocsGithubError("Le dossier contient des caractères non pris en charge.", 400);
  }
  return parts.join("/");
}

function cleanSlug(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) throw new DeveloperDocsGithubError("Slug de page invalide.", 400);
  return normalized;
}

function githubPath(path: string) {
  return path.split("/").map(segment => encodeURIComponent(segment)).join("/");
}

async function decryptStoredConnection(value?: string): Promise<StoredConnection | null> {
  if (!value || !process.env.SESSION_SECRET) return null;

  try {
    const { plaintext } = await compactDecrypt(value, connectionKey());
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as StoredConnection;
    if (!parsed?.owner || !parsed?.repo || !parsed?.branch || !parsed?.basePath) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function encryptStoredConnection(value: StoredConnection) {
  return new CompactEncrypt(new TextEncoder().encode(JSON.stringify(value)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(connectionKey());
}

export function normalizeDeveloperDocsConnection(input: {
  owner?: unknown;
  repo?: unknown;
  branch?: unknown;
  basePath?: unknown;
}) {
  return {
    owner: cleanRepoSegment(String(input.owner || ""), process.env.GITHUB_DOCS_OWNER?.trim() || DEFAULT_OWNER),
    repo: cleanRepoSegment(String(input.repo || ""), process.env.GITHUB_DOCS_REPO?.trim() || DEFAULT_REPO),
    branch: cleanBranch(String(input.branch || ""), process.env.GITHUB_DOCS_BRANCH?.trim() || DEFAULT_BRANCH),
    basePath: cleanBasePath(String(input.basePath || ""), process.env.GITHUB_DOCS_PATH?.trim() || DEFAULT_BASE_PATH),
  };
}

export async function getDeveloperDocsConnection(): Promise<DeveloperDocsConnection> {
  const stored = await decryptStoredConnection((await cookies()).get(CONNECTION_COOKIE)?.value);
  const defaults = normalizeDeveloperDocsConnection({
    owner: process.env.GITHUB_DOCS_OWNER || DEFAULT_OWNER,
    repo: process.env.GITHUB_DOCS_REPO || DEFAULT_REPO,
    branch: process.env.GITHUB_DOCS_BRANCH || DEFAULT_BRANCH,
    basePath: process.env.GITHUB_DOCS_PATH || DEFAULT_BASE_PATH,
  });

  const serverToken = process.env.GITHUB_DOCS_TOKEN?.trim();
  const browserToken = stored?.token?.trim();

  return {
    owner: stored?.owner || defaults.owner,
    repo: stored?.repo || defaults.repo,
    branch: stored?.branch || defaults.branch,
    basePath: stored?.basePath || defaults.basePath,
    token: serverToken || browserToken || undefined,
    tokenSource: serverToken ? "server" : browserToken ? "browser" : "none",
  };
}

export async function saveDeveloperDocsConnection(input: {
  owner: string;
  repo: string;
  branch: string;
  basePath: string;
  token?: string;
}) {
  const normalized = normalizeDeveloperDocsConnection(input);
  const existing = await decryptStoredConnection((await cookies()).get(CONNECTION_COOKIE)?.value);
  const serverToken = process.env.GITHUB_DOCS_TOKEN?.trim();
  const suppliedToken = input.token?.trim();

  const stored: StoredConnection = {
    ...normalized,
    token: serverToken ? undefined : suppliedToken || existing?.token,
    issuedAt: Date.now(),
  };

  (await cookies()).set(CONNECTION_COOKIE, await encryptStoredConnection(stored), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CONNECTION_MAX_AGE,
    priority: "high",
  });

  return {
    ...normalized,
    token: serverToken || stored.token || undefined,
    tokenSource: serverToken ? "server" as const : stored.token ? "browser" as const : "none" as const,
  };
}

export async function clearDeveloperDocsConnection() {
  (await cookies()).delete(CONNECTION_COOKIE);
}

async function githubRequest<T>(
  connection: DeveloperDocsConnection,
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  headers.set("User-Agent", "gando-sales-cockpit");
  if (connection.token) headers.set("Authorization", `Bearer ${connection.token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    const fallback = response.status === 404
      ? "Dépôt, branche ou fichier GitHub introuvable."
      : response.status === 401
        ? "Le token GitHub n’est pas valide."
        : response.status === 403
          ? "Le token GitHub n’a pas les droits nécessaires."
          : "GitHub n’a pas pu traiter la demande.";
    throw new DeveloperDocsGithubError(payload?.message || fallback, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function testDeveloperDocsConnection(connection: DeveloperDocsConnection) {
  const repo = await githubRequest<GithubRepo>(
    connection,
    `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}`,
  );
  const branch = await githubRequest<GithubBranch>(
    connection,
    `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/branches/${encodeURIComponent(connection.branch)}`,
  );

  return {
    connected: true,
    writable: Boolean(repo.permissions?.push || repo.permissions?.admin || repo.permissions?.maintain),
    private: Boolean(repo.private),
    defaultBranch: repo.default_branch || null,
    branchProtected: Boolean(branch.protected),
    repoUrl: repo.html_url || `https://github.com/${connection.owner}/${connection.repo}`,
  };
}

function decodeGithubContent(file: GithubContentsFile) {
  if (file.encoding !== "base64" || typeof file.content !== "string") {
    throw new DeveloperDocsGithubError("Format de fichier GitHub non pris en charge.", 500);
  }
  return Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
}

function parseScalar(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      return trimmed.startsWith('"')
        ? String(JSON.parse(trimmed))
        : trimmed.slice(1, -1).replace(/''/g, "'");
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function parseFrontmatter(source: string) {
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) {
    return { metadata: {} as Record<string, string>, body: source };
  }

  const normalized = source.replace(/\r\n/g, "\n");
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) return { metadata: {} as Record<string, string>, body: source };

  const metadata: Record<string, string> = {};
  for (const line of normalized.slice(4, end).split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    metadata[line.slice(0, separator).trim()] = parseScalar(line.slice(separator + 1));
  }

  return {
    metadata,
    body: normalized.slice(end + 5).replace(/^\n+/, ""),
  };
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pageFromFile(path: string, sha: string, source: string): DeveloperDocPage {
  const { metadata, body } = parseFrontmatter(source);
  const fileName = path.split("/").pop() || "page";
  const rawSlug = fileName.replace(/\.(md|mdx)$/i, "");
  const slug = metadata.slug ? cleanSlug(metadata.slug) : cleanSlug(rawSlug === "index" ? "accueil" : rawSlug);
  const status: DeveloperDocStatus = metadata.status === "published" ? "published" : "draft";
  const order = Number(metadata.order);

  return {
    id: path,
    path,
    sha,
    title: metadata.title || titleFromSlug(slug),
    slug,
    section: metadata.section || "Documentation",
    description: metadata.description || "",
    body,
    status,
    order: Number.isFinite(order) ? order : 999,
    updatedAt: metadata.updated_at || null,
  };
}

async function readDeveloperDocFile(connection: DeveloperDocsConnection, path: string) {
  const file = await githubRequest<GithubContentsFile>(
    connection,
    `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/contents/${githubPath(path)}?ref=${encodeURIComponent(connection.branch)}`,
  );
  if (file.type !== "file" || !file.path || !file.sha) {
    throw new DeveloperDocsGithubError("Fichier de documentation invalide.", 500);
  }
  return pageFromFile(file.path, file.sha, decodeGithubContent(file));
}

async function mapWithLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const output: R[] = [];
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      output.push(await worker(current));
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return output;
}

export async function listDeveloperDocPages(connection: DeveloperDocsConnection) {
  const tree = await githubRequest<GithubTreeResponse>(
    connection,
    `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/git/trees/${encodeURIComponent(connection.branch)}?recursive=1`,
  );

  const prefix = `${connection.basePath}/`;
  const paths = (tree.tree || [])
    .filter(item => item.type === "blob" && typeof item.path === "string")
    .map(item => item.path as string)
    .filter(path => path.startsWith(prefix) && /\.(md|mdx)$/i.test(path))
    .filter(path => !path.split("/").pop()?.startsWith("."))
    .slice(0, 100);

  const pages = await mapWithLimit(paths, 8, path => readDeveloperDocFile(connection, path));

  return pages.sort((a, b) => {
    const section = a.section.localeCompare(b.section, "fr");
    if (section !== 0) return section;
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title, "fr");
  });
}

function jsonScalar(value: string) {
  return JSON.stringify(value.trim());
}

function serializeDeveloperDocPage(page: {
  title: string;
  slug: string;
  section: string;
  description: string;
  body: string;
  status: DeveloperDocStatus;
  order: number;
}) {
  const updatedAt = new Date().toISOString();
  return [
    "---",
    `title: ${jsonScalar(page.title)}`,
    `slug: ${jsonScalar(page.slug)}`,
    `section: ${jsonScalar(page.section)}`,
    `description: ${jsonScalar(page.description)}`,
    `status: ${page.status}`,
    `order: ${Math.max(0, Math.round(page.order || 0))}`,
    `updated_at: ${jsonScalar(updatedAt)}`,
    "---",
    "",
    page.body.replace(/^\n+/, ""),
  ].join("\n");
}

function assertPathInBase(connection: DeveloperDocsConnection, path: string) {
  const normalized = path.trim().replace(/^\/+/, "");
  if (
    !normalized.startsWith(`${connection.basePath}/`)
    || normalized.includes("..")
    || !/\.(md|mdx)$/i.test(normalized)
  ) {
    throw new DeveloperDocsGithubError("Chemin de page invalide.", 400);
  }
  return normalized;
}

export async function saveDeveloperDocPage(
  connection: DeveloperDocsConnection,
  input: {
    path?: string;
    sha?: string;
    title: string;
    slug: string;
    section: string;
    description: string;
    body: string;
    status: DeveloperDocStatus;
    order: number;
  },
) {
  if (!connection.token) {
    throw new DeveloperDocsGithubError("Ajoutez un token GitHub avant de modifier la documentation.", 409);
  }

  const title = input.title.trim();
  const section = input.section.trim() || "Documentation";
  if (!title) throw new DeveloperDocsGithubError("Le titre de la page est obligatoire.", 400);

  const slug = cleanSlug(input.slug || title);
  const path = input.path
    ? assertPathInBase(connection, input.path)
    : `${connection.basePath}/${slug}.mdx`;

  const source = serializeDeveloperDocPage({
    title,
    slug,
    section,
    description: input.description || "",
    body: input.body || "",
    status: input.status === "published" ? "published" : "draft",
    order: Number.isFinite(input.order) ? input.order : 999,
  });

  const payload: Record<string, unknown> = {
    message: input.status === "published"
      ? `docs: publish ${title}`
      : `docs: save draft ${title}`,
    content: Buffer.from(source, "utf8").toString("base64"),
    branch: connection.branch,
  };
  if (input.sha) payload.sha = input.sha;

  await githubRequest(
    connection,
    `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/contents/${githubPath(path)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );

  return readDeveloperDocFile(connection, path);
}

export async function deleteDeveloperDocPage(
  connection: DeveloperDocsConnection,
  input: { path: string; sha: string; title?: string },
) {
  if (!connection.token) {
    throw new DeveloperDocsGithubError("Ajoutez un token GitHub avant de supprimer une page.", 409);
  }

  const path = assertPathInBase(connection, input.path);
  await githubRequest(
    connection,
    `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/contents/${githubPath(path)}`,
    {
      method: "DELETE",
      body: JSON.stringify({
        message: `docs: delete ${input.title?.trim() || path.split("/").pop()}`,
        sha: input.sha,
        branch: connection.branch,
      }),
    },
  );
}


export type DeveloperDocsRepositoryOption = {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  writable: boolean;
  updatedAt: string | null;
  url: string;
};

type GithubRepositoryListItem = {
  name?: string;
  full_name?: string;
  private?: boolean;
  default_branch?: string;
  html_url?: string;
  updated_at?: string;
  owner?: { login?: string };
  permissions?: {
    pull?: boolean;
    push?: boolean;
    admin?: boolean;
    maintain?: boolean;
  };
};

type GithubBranchListItem = {
  name?: string;
  protected?: boolean;
};

export async function listDeveloperDocsRepositories(
  connection: DeveloperDocsConnection,
  query = "",
): Promise<DeveloperDocsRepositoryOption[]> {
  if (!connection.token) {
    throw new DeveloperDocsGithubError("Connectez GitHub avant de choisir un dépôt.", 409);
  }

  const repositories = await githubRequest<GithubRepositoryListItem[]>(
    connection,
    "/user/repos?per_page=100&sort=updated&direction=desc&affiliation=owner,collaborator,organization_member",
  );

  const normalizedQuery = query.trim().toLowerCase();

  return repositories
    .filter(repo => repo.name && repo.owner?.login)
    .map(repo => ({
      owner: repo.owner?.login as string,
      name: repo.name as string,
      fullName: repo.full_name || `${repo.owner?.login}/${repo.name}`,
      private: Boolean(repo.private),
      defaultBranch: repo.default_branch || "main",
      writable: Boolean(repo.permissions?.push || repo.permissions?.admin || repo.permissions?.maintain),
      updatedAt: repo.updated_at || null,
      url: repo.html_url || `https://github.com/${repo.owner?.login}/${repo.name}`,
    }))
    .filter(repo => !normalizedQuery || repo.fullName.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => {
      if (a.writable !== b.writable) return a.writable ? -1 : 1;
      const aDate = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const bDate = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return bDate - aDate;
    });
}

export async function listDeveloperDocsRepositoryOptions(
  connection: DeveloperDocsConnection,
  input: { owner: string; repo: string; branch?: string },
) {
  if (!connection.token) {
    throw new DeveloperDocsGithubError("Connectez GitHub avant de choisir un dépôt.", 409);
  }

  const owner = cleanRepoSegment(input.owner, "");
  const repo = cleanRepoSegment(input.repo, "");
  if (!owner || !repo) {
    throw new DeveloperDocsGithubError("Sélectionnez un dépôt GitHub.", 400);
  }

  const repoConnection: DeveloperDocsConnection = {
    ...connection,
    owner,
    repo,
    branch: input.branch || connection.branch,
  };

  const repository = await githubRequest<GithubRepo>(
    repoConnection,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );
  const branches = await githubRequest<GithubBranchListItem[]>(
    repoConnection,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
  );

  const branch = cleanBranch(
    input.branch || repository.default_branch || branches[0]?.name || "main",
    repository.default_branch || "main",
  );

  const tree = await githubRequest<GithubTreeResponse>(
    { ...repoConnection, branch },
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );

  const directories = (tree.tree || [])
    .filter(item => item.type === "tree" && typeof item.path === "string")
    .map(item => item.path as string)
    .filter(path => path && path.split("/").length <= 5)
    .sort((a, b) => {
      const aDocs = /(^|\/)(docs?|documentation)(\/|$)/i.test(a);
      const bDocs = /(^|\/)(docs?|documentation)(\/|$)/i.test(b);
      if (aDocs !== bDocs) return aDocs ? -1 : 1;
      return a.localeCompare(b);
    })
    .slice(0, 250);

  return {
    repository: {
      owner,
      name: repo,
      fullName: `${owner}/${repo}`,
      private: Boolean(repository.private),
      defaultBranch: repository.default_branch || branch,
      writable: Boolean(repository.permissions?.push || repository.permissions?.admin || repository.permissions?.maintain),
      url: repository.html_url || `https://github.com/${owner}/${repo}`,
    },
    branches: branches
      .filter(item => item.name)
      .map(item => ({ name: item.name as string, protected: Boolean(item.protected) })),
    directories,
    selectedBranch: branch,
  };
}

export function publicDeveloperDocsConnection(connection: DeveloperDocsConnection) {
  return {
    owner: connection.owner,
    repo: connection.repo,
    branch: connection.branch,
    basePath: connection.basePath,
    tokenSource: connection.tokenSource,
    hasToken: Boolean(connection.token),
    oauthAvailable: Boolean(
      process.env.GITHUB_DOCS_CLIENT_ID?.trim()
      && process.env.GITHUB_DOCS_CLIENT_SECRET?.trim()
    ),
  };
}


export type DeveloperSiteSettings = {
  general: {
    siteName: string;
    siteUrl: string;
    language: string;
  };
  styling: {
    accentColor: string;
    radius: string;
    theme: "system" | "light" | "dark";
  };
  branding: {
    logoLight: string;
    logoDark: string;
    logoDestination: string;
    faviconLight: string;
    faviconDark: string;
  };
  typography: {
    fontFamily: string;
    headingFontFamily: string;
  };
  navbar: {
    enabled: boolean;
    ctaLabel: string;
    ctaUrl: string;
  };
  footer: {
    enabled: boolean;
    copyright: string;
  };
  banner: {
    enabled: boolean;
    text: string;
    link: string;
  };
  thumbnail: {
    image: string;
  };
  content: {
    editLink: boolean;
    feedback: boolean;
  };
  codeblocks: {
    theme: string;
    showCopy: boolean;
    showLineNumbers: boolean;
  };
  contextMenu: {
    enabled: boolean;
    copyLink: boolean;
  };
  navigationBehavior: {
    openFirst: boolean;
    showIcons: boolean;
  };
  search: {
    enabled: boolean;
    placeholder: string;
  };
  navigation: {
    categories: string[];
  };
  apiReference: {
    enabled: boolean;
    partnerPath: string;
    operatorPath: string;
  };
  redirects: Array<{ from: string; to: string }>;
};

export const DEFAULT_DEVELOPER_SITE_SETTINGS: DeveloperSiteSettings = {
  general: {
    siteName: "Gando Developers",
    siteUrl: "https://app.gando.app",
    language: "fr",
  },
  styling: {
    accentColor: "#735DF3",
    radius: "12",
    theme: "system",
  },
  branding: {
    logoLight: "/assets/gando-docs-light.svg",
    logoDark: "/assets/gando-docs-dark.svg",
    logoDestination: "/",
    faviconLight: "/assets/gando-docs-favicon.svg",
    faviconDark: "/assets/gando-docs-favicon.svg",
  },
  typography: {
    fontFamily: "Inter",
    headingFontFamily: "Inter",
  },
  navbar: {
    enabled: true,
    ctaLabel: "Dashboard",
    ctaUrl: "https://app.gando.app",
  },
  footer: {
    enabled: true,
    copyright: "Gando",
  },
  banner: {
    enabled: false,
    text: "",
    link: "",
  },
  thumbnail: {
    image: "",
  },
  content: {
    editLink: true,
    feedback: true,
  },
  codeblocks: {
    theme: "github-dark",
    showCopy: true,
    showLineNumbers: false,
  },
  contextMenu: {
    enabled: true,
    copyLink: true,
  },
  navigationBehavior: {
    openFirst: true,
    showIcons: true,
  },
  search: {
    enabled: true,
    placeholder: "Rechercher dans la documentation…",
  },
  navigation: {
    categories: [],
  },
  apiReference: {
    enabled: true,
    partnerPath: "/partner",
    operatorPath: "/operator",
  },
  redirects: [],
};

function mergeDeveloperSiteSettings(input: unknown): DeveloperSiteSettings {
  const source = input && typeof input === "object" ? input as Partial<DeveloperSiteSettings> : {};
  return {
    general: { ...DEFAULT_DEVELOPER_SITE_SETTINGS.general, ...(source.general || {}) },
    styling: { ...DEFAULT_DEVELOPER_SITE_SETTINGS.styling, ...(source.styling || {}) },
    branding: { ...DEFAULT_DEVELOPER_SITE_SETTINGS.branding, ...(source.branding || {}) },
    typography: { ...DEFAULT_DEVELOPER_SITE_SETTINGS.typography, ...(source.typography || {}) },
    navbar: { ...DEFAULT_DEVELOPER_SITE_SETTINGS.navbar, ...(source.navbar || {}) },
    footer: { ...DEFAULT_DEVELOPER_SITE_SETTINGS.footer, ...(source.footer || {}) },
    banner: { ...DEFAULT_DEVELOPER_SITE_SETTINGS.banner, ...(source.banner || {}) },
    thumbnail: { ...DEFAULT_DEVELOPER_SITE_SETTINGS.thumbnail, ...(source.thumbnail || {}) },
    content: { ...DEFAULT_DEVELOPER_SITE_SETTINGS.content, ...(source.content || {}) },
    codeblocks: { ...DEFAULT_DEVELOPER_SITE_SETTINGS.codeblocks, ...(source.codeblocks || {}) },
    contextMenu: { ...DEFAULT_DEVELOPER_SITE_SETTINGS.contextMenu, ...(source.contextMenu || {}) },
    navigationBehavior: { ...DEFAULT_DEVELOPER_SITE_SETTINGS.navigationBehavior, ...(source.navigationBehavior || {}) },
    search: { ...DEFAULT_DEVELOPER_SITE_SETTINGS.search, ...(source.search || {}) },
    navigation: {
      categories: Array.isArray(source.navigation?.categories)
        ? source.navigation.categories.map(item => String(item).trim()).filter(Boolean)
        : [],
    },
    apiReference: { ...DEFAULT_DEVELOPER_SITE_SETTINGS.apiReference, ...(source.apiReference || {}) },
    redirects: Array.isArray(source.redirects)
      ? source.redirects
          .map(item => ({
            from: String(item?.from || "").trim(),
            to: String(item?.to || "").trim(),
          }))
          .filter(item => item.from && item.to)
      : [],
  };
}

function developerSiteSettingsPath(connection: DeveloperDocsConnection) {
  return `${connection.basePath}/site.config.json`;
}

export async function getDeveloperSiteSettings(connection: DeveloperDocsConnection) {
  const path = developerSiteSettingsPath(connection);
  try {
    const file = await githubRequest<GithubContentsFile>(
      connection,
      `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/contents/${githubPath(path)}?ref=${encodeURIComponent(connection.branch)}`,
    );
    const parsed = JSON.parse(decodeGithubContent(file));
    return {
      settings: mergeDeveloperSiteSettings(parsed),
      sha: file.sha || "",
      path,
    };
  } catch (error) {
    if (error instanceof DeveloperDocsGithubError && error.status === 404) {
      return {
        settings: DEFAULT_DEVELOPER_SITE_SETTINGS,
        sha: "",
        path,
      };
    }
    throw error;
  }
}

export async function saveDeveloperSiteSettings(
  connection: DeveloperDocsConnection,
  input: unknown,
) {
  if (!connection.token) {
    throw new DeveloperDocsGithubError("Ajoutez un token GitHub avant de modifier les paramètres du site.", 409);
  }

  const current = await getDeveloperSiteSettings(connection);
  const patch = input && typeof input === "object" ? input as Partial<DeveloperSiteSettings> : {};
  const settings = mergeDeveloperSiteSettings({
    ...current.settings,
    ...patch,
    general: { ...current.settings.general, ...(patch.general || {}) },
    styling: { ...current.settings.styling, ...(patch.styling || {}) },
    branding: { ...current.settings.branding, ...(patch.branding || {}) },
    typography: { ...current.settings.typography, ...(patch.typography || {}) },
    navbar: { ...current.settings.navbar, ...(patch.navbar || {}) },
    footer: { ...current.settings.footer, ...(patch.footer || {}) },
    banner: { ...current.settings.banner, ...(patch.banner || {}) },
    thumbnail: { ...current.settings.thumbnail, ...(patch.thumbnail || {}) },
    content: { ...current.settings.content, ...(patch.content || {}) },
    codeblocks: { ...current.settings.codeblocks, ...(patch.codeblocks || {}) },
    contextMenu: { ...current.settings.contextMenu, ...(patch.contextMenu || {}) },
    navigationBehavior: { ...current.settings.navigationBehavior, ...(patch.navigationBehavior || {}) },
    search: { ...current.settings.search, ...(patch.search || {}) },
    navigation: { ...current.settings.navigation, ...(patch.navigation || {}) },
    apiReference: { ...current.settings.apiReference, ...(patch.apiReference || {}) },
    redirects: patch.redirects ?? current.settings.redirects,
  });
  const payload: Record<string, unknown> = {
    message: "docs: update developer site settings",
    content: Buffer.from(JSON.stringify(settings, null, 2) + "\n", "utf8").toString("base64"),
    branch: connection.branch,
  };
  if (current.sha) payload.sha = current.sha;

  await githubRequest(
    connection,
    `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/contents/${githubPath(current.path)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );

  return getDeveloperSiteSettings(connection);
}

function cleanDeveloperAssetName(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
  const base = (dot >= 0 ? fileName.slice(0, dot) : fileName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "image";
  return `${base}${ext}`;
}

export async function uploadDeveloperDocsAsset(
  connection: DeveloperDocsConnection,
  input: { fileName: string; bytes: Buffer },
) {
  if (!connection.token) {
    throw new DeveloperDocsGithubError("Ajoutez un token GitHub avant d’envoyer une image.", 409);
  }

  const safeName = cleanDeveloperAssetName(input.fileName);
  const uniqueName = `${Date.now()}-${safeName}`;
  const path = `public/developer-docs-assets/${uniqueName}`;

  await githubRequest(
    connection,
    `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/contents/${githubPath(path)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: `docs: upload ${safeName}`,
        content: input.bytes.toString("base64"),
        branch: connection.branch,
      }),
    },
  );

  return {
    path,
    src: `/developer-docs-assets/${uniqueName}`,
    fileName: uniqueName,
  };
}

export async function readDeveloperDocsAsset(
  connection: DeveloperDocsConnection,
  path: string,
) {
  const normalized = path.trim().replace(/^\/+/, "");
  if (
    !normalized.startsWith("public/developer-docs-assets/")
    || normalized.includes("..")
  ) {
    throw new DeveloperDocsGithubError("Chemin d’image invalide.", 400);
  }

  const file = await githubRequest<GithubContentsFile>(
    connection,
    `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/contents/${githubPath(normalized)}?ref=${encodeURIComponent(connection.branch)}`,
  );
  if (file.type !== "file") {
    throw new DeveloperDocsGithubError("Image GitHub invalide.", 404);
  }

  if (file.encoding === "base64" && typeof file.content === "string" && file.content.trim()) {
    return Buffer.from(file.content.replace(/\n/g, ""), "base64");
  }

  if (file.sha) {
    const blob = await githubRequest<{ content?: string; encoding?: string }>(
      connection,
      `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/git/blobs/${encodeURIComponent(file.sha)}`,
    );
    if (blob.encoding === "base64" && typeof blob.content === "string") {
      return Buffer.from(blob.content.replace(/\n/g, ""), "base64");
    }
  }

  throw new DeveloperDocsGithubError("Format d’image GitHub non pris en charge.", 500);
}
