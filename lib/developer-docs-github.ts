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

export function publicDeveloperDocsConnection(connection: DeveloperDocsConnection) {
  return {
    owner: connection.owner,
    repo: connection.repo,
    branch: connection.branch,
    basePath: connection.basePath,
    tokenSource: connection.tokenSource,
    hasToken: Boolean(connection.token),
  };
}
