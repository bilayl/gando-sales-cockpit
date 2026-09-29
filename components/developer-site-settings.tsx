"use client";

import {
  ArrowLeft,
  Braces,
  Code2,
  FileImage,
  Globe2,
  ImageIcon,
  LayoutPanelTop,
  Link2,
  Loader2,
  Menu,
  Navigation,
  Palette,
  PanelTop,
  Pilcrow,
  Search,
  Settings2,
  Sparkles,
  Type,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

type SiteSettings = {
  general: { siteName: string; siteUrl: string; language: string };
  styling: { accentColor: string; radius: string; theme: "system" | "light" | "dark" };
  branding: { logoLight: string; logoDark: string; logoDestination: string; faviconLight: string; faviconDark: string };
  typography: { fontFamily: string; headingFontFamily: string };
  navbar: { enabled: boolean; ctaLabel: string; ctaUrl: string };
  footer: { enabled: boolean; copyright: string };
  banner: { enabled: boolean; text: string; link: string };
  thumbnail: { image: string };
  content: { editLink: boolean; feedback: boolean };
  codeblocks: { theme: string; showCopy: boolean; showLineNumbers: boolean };
  contextMenu: { enabled: boolean; copyLink: boolean };
  navigationBehavior: { openFirst: boolean; showIcons: boolean };
  search: { enabled: boolean; placeholder: string };
  navigation: { categories: string[] };
  apiReference: { enabled: boolean; partnerPath: string; operatorPath: string };
  redirects: Array<{ from: string; to: string }>;
};

const sections = [
  { group: "Appearance", items: [
    { id: "general", label: "General", icon: Globe2 },
    { id: "styling", label: "Styling", icon: Palette },
    { id: "branding", label: "Branding", icon: ImageIcon },
    { id: "typography", label: "Typography", icon: Type },
  ]},
  { group: "Layout", items: [
    { id: "navbar", label: "Navbar", icon: PanelTop },
    { id: "footer", label: "Footer", icon: LayoutPanelTop },
    { id: "banner", label: "Banner", icon: Sparkles },
    { id: "thumbnail", label: "Thumbnail", icon: FileImage },
  ]},
  { group: "Content", items: [
    { id: "content", label: "Content", icon: Pilcrow },
    { id: "codeblocks", label: "Codeblocks", icon: Code2 },
    { id: "contextMenu", label: "Context menu", icon: Menu },
    { id: "navigationBehavior", label: "Navigation behavior", icon: Navigation },
    { id: "search", label: "Search", icon: Search },
  ]},
  { group: "Configuration", items: [
    { id: "navigation", label: "Navigation", icon: Navigation },
    { id: "apiReference", label: "API reference", icon: Braces },
    { id: "redirects", label: "Redirects", icon: Link2 },
  ]},
] as const;

function Field({
  label,
  description,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="site-settings-field">
      <span className="site-settings-label">{label}</span>
      {description ? <span className="site-settings-description">{description}</span> : null}
      <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="site-settings-toggle-row">
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
    </label>
  );
}

export function DeveloperSiteSettings({
  open,
  onClose,
  onSettingsSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSettingsSaved?: (settings: SiteSettings) => void;
}) {
  const [active, setActive] = useState("branding");
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const uploadTarget = useRef<keyof SiteSettings["branding"] | "thumbnail" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    void fetch("/api/developer-docs/settings", { cache: "no-store" })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Impossible de charger les paramètres.");
        setSettings(body.settings as SiteSettings);
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Impossible de charger les paramètres."))
      .finally(() => setLoading(false));
  }, [open]);

  const currentLabel = useMemo(() => (
    sections.flatMap(group => group.items).find(item => item.id === active)?.label || "Settings"
  ), [active]);

  if (!open) return null;

  function patch<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setSettings(current => current ? { ...current, [key]: value } : current);
    setMessage("");
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/developer-docs/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Impossible d’enregistrer les paramètres.");
      setSettings(body.settings as SiteSettings);
      onSettingsSaved?.(body.settings as SiteSettings);
      setMessage("Paramètres enregistrés dans GitHub.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer les paramètres.");
    } finally {
      setSaving(false);
    }
  }

  function chooseUpload(target: keyof SiteSettings["branding"] | "thumbnail") {
    uploadTarget.current = target;
    fileRef.current?.click();
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const target = uploadTarget.current;
    event.target.value = "";
    if (!file || !target || !settings) return;

    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/developer-docs/assets", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.src) throw new Error(body.error || "Upload impossible.");

      if (target === "thumbnail") {
        patch("thumbnail", { ...settings.thumbnail, image: String(body.src) });
      } else {
        patch("branding", { ...settings.branding, [target]: String(body.src) });
      }
      setMessage("Image envoyée. Enregistrez les paramètres pour conserver cette valeur.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload impossible.");
    } finally {
      setSaving(false);
    }
  }

  function renderPanel() {
    if (!settings) return null;

    switch (active) {
      case "general":
        return (
          <>
            <Field label="Site name" value={settings.general.siteName} onChange={siteName => patch("general", { ...settings.general, siteName })} />
            <Field label="Site URL" value={settings.general.siteUrl} onChange={siteUrl => patch("general", { ...settings.general, siteUrl })} />
            <Field label="Language" value={settings.general.language} onChange={language => patch("general", { ...settings.general, language })} />
          </>
        );
      case "styling":
        return (
          <>
            <Field label="Accent color" value={settings.styling.accentColor} onChange={accentColor => patch("styling", { ...settings.styling, accentColor })} />
            <Field label="Border radius" value={settings.styling.radius} onChange={radius => patch("styling", { ...settings.styling, radius })} />
            <Field label="Theme" value={settings.styling.theme} onChange={theme => patch("styling", { ...settings.styling, theme: theme as SiteSettings["styling"]["theme"] })} />
          </>
        );
      case "branding":
        return (
          <div className="site-settings-card">
            {([
              ["logoLight", "Logo light", "The file for the light version of the logo used in dark mode."],
              ["logoDark", "Logo dark", "The file for the dark version of the logo used in light mode."],
              ["faviconLight", "Favicon light", "The favicon used in dark mode."],
              ["faviconDark", "Favicon dark", "The favicon used in light mode."],
            ] as const).map(([key, label, description]) => (
              <div key={key} className="site-settings-upload-row">
                <div className="min-w-0 flex-1">
                  <div className="site-settings-label">{label}</div>
                  <div className="site-settings-description">{description}</div>
                  <input value={settings.branding[key]} onChange={event => patch("branding", { ...settings.branding, [key]: event.target.value })} />
                </div>
                <button type="button" onClick={() => chooseUpload(key)}><Upload className="size-4" /> Upload</button>
              </div>
            ))}
            <div className="site-settings-upload-row">
              <div className="min-w-0 flex-1">
                <div className="site-settings-label">Logo destination</div>
                <div className="site-settings-description">The URL to redirect to when clicking the logo.</div>
                <input value={settings.branding.logoDestination} onChange={event => patch("branding", { ...settings.branding, logoDestination: event.target.value })} />
              </div>
            </div>
          </div>
        );
      case "typography":
        return (
          <>
            <Field label="Body font" value={settings.typography.fontFamily} onChange={fontFamily => patch("typography", { ...settings.typography, fontFamily })} />
            <Field label="Heading font" value={settings.typography.headingFontFamily} onChange={headingFontFamily => patch("typography", { ...settings.typography, headingFontFamily })} />
          </>
        );
      case "navbar":
        return (
          <>
            <Toggle label="Navbar enabled" checked={settings.navbar.enabled} onChange={enabled => patch("navbar", { ...settings.navbar, enabled })} />
            <Field label="CTA label" value={settings.navbar.ctaLabel} onChange={ctaLabel => patch("navbar", { ...settings.navbar, ctaLabel })} />
            <Field label="CTA URL" value={settings.navbar.ctaUrl} onChange={ctaUrl => patch("navbar", { ...settings.navbar, ctaUrl })} />
          </>
        );
      case "footer":
        return (
          <>
            <Toggle label="Footer enabled" checked={settings.footer.enabled} onChange={enabled => patch("footer", { ...settings.footer, enabled })} />
            <Field label="Copyright" value={settings.footer.copyright} onChange={copyright => patch("footer", { ...settings.footer, copyright })} />
          </>
        );
      case "banner":
        return (
          <>
            <Toggle label="Banner enabled" checked={settings.banner.enabled} onChange={enabled => patch("banner", { ...settings.banner, enabled })} />
            <Field label="Banner text" value={settings.banner.text} onChange={text => patch("banner", { ...settings.banner, text })} />
            <Field label="Banner link" value={settings.banner.link} onChange={link => patch("banner", { ...settings.banner, link })} />
          </>
        );
      case "thumbnail":
        return (
          <div className="site-settings-card">
            <div className="site-settings-upload-row">
              <div className="min-w-0 flex-1">
                <div className="site-settings-label">Social thumbnail</div>
                <div className="site-settings-description">Image utilisée pour les aperçus de partage.</div>
                <input value={settings.thumbnail.image} onChange={event => patch("thumbnail", { image: event.target.value })} />
              </div>
              <button type="button" onClick={() => chooseUpload("thumbnail")}><Upload className="size-4" /> Upload</button>
            </div>
          </div>
        );
      case "content":
        return (
          <>
            <Toggle label="Edit link" checked={settings.content.editLink} onChange={editLink => patch("content", { ...settings.content, editLink })} />
            <Toggle label="Feedback" checked={settings.content.feedback} onChange={feedback => patch("content", { ...settings.content, feedback })} />
          </>
        );
      case "codeblocks":
        return (
          <>
            <Field label="Theme" value={settings.codeblocks.theme} onChange={theme => patch("codeblocks", { ...settings.codeblocks, theme })} />
            <Toggle label="Copy button" checked={settings.codeblocks.showCopy} onChange={showCopy => patch("codeblocks", { ...settings.codeblocks, showCopy })} />
            <Toggle label="Line numbers" checked={settings.codeblocks.showLineNumbers} onChange={showLineNumbers => patch("codeblocks", { ...settings.codeblocks, showLineNumbers })} />
          </>
        );
      case "contextMenu":
        return (
          <>
            <Toggle label="Context menu" checked={settings.contextMenu.enabled} onChange={enabled => patch("contextMenu", { ...settings.contextMenu, enabled })} />
            <Toggle label="Copy link action" checked={settings.contextMenu.copyLink} onChange={copyLink => patch("contextMenu", { ...settings.contextMenu, copyLink })} />
          </>
        );
      case "navigationBehavior":
        return (
          <>
            <Toggle label="Open first section" checked={settings.navigationBehavior.openFirst} onChange={openFirst => patch("navigationBehavior", { ...settings.navigationBehavior, openFirst })} />
            <Toggle label="Show icons" checked={settings.navigationBehavior.showIcons} onChange={showIcons => patch("navigationBehavior", { ...settings.navigationBehavior, showIcons })} />
          </>
        );
      case "search":
        return (
          <>
            <Toggle label="Search enabled" checked={settings.search.enabled} onChange={enabled => patch("search", { ...settings.search, enabled })} />
            <Field label="Placeholder" value={settings.search.placeholder} onChange={placeholder => patch("search", { ...settings.search, placeholder })} />
          </>
        );
      case "navigation":
        return (
          <div className="site-settings-card">
            <div className="site-settings-label">Categories</div>
            <div className="site-settings-description">Ordre et noms des catégories affichées dans la navigation.</div>
            <div className="site-settings-category-list">
              {settings.navigation.categories.map((category, index) => (
                <div key={index} className="site-settings-category-row">
                  <input
                    value={category}
                    onChange={event => {
                      const categories = [...settings.navigation.categories];
                      categories[index] = event.target.value;
                      patch("navigation", { categories });
                    }}
                  />
                  <button type="button" onClick={() => patch("navigation", { categories: settings.navigation.categories.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="site-settings-add-row" onClick={() => patch("navigation", { categories: [...settings.navigation.categories, "Nouvelle catégorie"] })}>+ Ajouter une catégorie</button>
          </div>
        );
      case "apiReference":
        return (
          <>
            <Toggle label="API reference enabled" checked={settings.apiReference.enabled} onChange={enabled => patch("apiReference", { ...settings.apiReference, enabled })} />
            <Field label="Partner path" value={settings.apiReference.partnerPath} onChange={partnerPath => patch("apiReference", { ...settings.apiReference, partnerPath })} />
            <Field label="Operator path" value={settings.apiReference.operatorPath} onChange={operatorPath => patch("apiReference", { ...settings.apiReference, operatorPath })} />
          </>
        );
      case "redirects":
        return (
          <div className="site-settings-card">
            <div className="site-settings-label">Redirects</div>
            <div className="site-settings-description">Redirections de routes pour la documentation.</div>
            {settings.redirects.map((redirect, index) => (
              <div key={index} className="site-settings-redirect-row">
                <input value={redirect.from} placeholder="/ancien" onChange={event => {
                  const redirects = [...settings.redirects];
                  redirects[index] = { ...redirects[index], from: event.target.value };
                  patch("redirects", redirects);
                }} />
                <span>→</span>
                <input value={redirect.to} placeholder="/nouveau" onChange={event => {
                  const redirects = [...settings.redirects];
                  redirects[index] = { ...redirects[index], to: event.target.value };
                  patch("redirects", redirects);
                }} />
                <button type="button" onClick={() => patch("redirects", settings.redirects.filter((_, itemIndex) => itemIndex !== index))}>×</button>
              </div>
            ))}
            <button type="button" className="site-settings-add-row" onClick={() => patch("redirects", [...settings.redirects, { from: "", to: "" }])}>+ Ajouter une redirection</button>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="site-settings-overlay">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />

      <aside className="site-settings-sidebar">
        <button type="button" className="site-settings-back" onClick={onClose}>
          <ArrowLeft className="size-4" />
          Back to editor
        </button>

        <div className="site-settings-nav-scroll">
          {sections.map(group => (
            <div key={group.group} className="site-settings-nav-group">
              <div className="site-settings-nav-title">{group.group}</div>
              {group.items.map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.id} type="button" className={active === item.id ? "is-active" : ""} onClick={() => setActive(item.id)}>
                    <Icon className="size-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      <main className="site-settings-main">
        <header className="site-settings-main-header">
          <div>
            <div className="site-settings-kicker">Site settings</div>
            <h1>{currentLabel}</h1>
          </div>
          <button type="button" onClick={() => void save()} disabled={saving || !settings} className="site-settings-save">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Settings2 className="size-4" />}
            Save changes
          </button>
        </header>

        <div className="site-settings-content">
          {loading ? (
            <div className="grid min-h-60 place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
          ) : error ? (
            <div className="site-settings-error">{error}</div>
          ) : (
            renderPanel()
          )}
          {message ? <div className="site-settings-message">{message}</div> : null}
        </div>
      </main>
    </div>
  );
}
