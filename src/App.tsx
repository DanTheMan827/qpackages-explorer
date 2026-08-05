import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  ApiError,
  getDirectSourceUrl,
  getPackageDetail,
  getPackages,
  getPackageVersions,
} from "./lib/api";
import {
  compareVersionsDescending,
  displayValue,
  isHttpUrl,
  pluralize,
} from "./lib/format";
import type {
  AdditionalPackageMetadata,
  PackageDependency,
  PackageDetail,
  PackageVersion,
  RestoredDependency,
} from "./lib/types";
import {
  ChevronIcon,
  CodeIcon,
  ExternalLinkIcon,
  LinkIcon,
  PackageIcon,
  RefreshIcon,
  SearchIcon,
  SunMoonIcon,
} from "./components/Icons";
import { JsonViewer } from "./components/JsonViewer";
import { ErrorPanel, LoadingPanel } from "./components/Status";

type TabId = "overview" | "dependencies" | "workspace" | "json";
const tabs: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "dependencies", label: "Dependencies" },
  { id: "workspace", label: "Workspace" },
  { id: "json", label: "Raw JSON" },
];
const versionsCache = new Map<string, PackageVersion[]>();
const detailCache = new Map<string, PackageDetail>();

function errorText(error: unknown): string {
  if (error instanceof ApiError)
    return `${error.status ? `HTTP ${error.status}: ` : ""}${error.message}`;
  return error instanceof Error ? error.message : "An unknown error occurred.";
}
function updateUrl(packageId?: string, version?: string) {
  const url = new URL(window.location.href);
  packageId
    ? url.searchParams.set("package", packageId)
    : url.searchParams.delete("package");
  version
    ? url.searchParams.set("version", version)
    : url.searchParams.delete("version");
  history.replaceState({}, "", url);
}
function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>{displayValue(value)}</dd>
    </div>
  );
}
function SmartLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="smart-link" href={href} target="_blank" rel="noreferrer">
      <span>{children}</span>
      <ExternalLinkIcon />
    </a>
  );
}
function MetadataBadges({ data }: { data: Record<string, unknown> }) {
  const values: string[] = [];
  if (data.headersOnly === true) values.push("Header only");
  if (data.cmake === true) values.push("CMake");
  if (data.staticLinking === true || typeof data.staticLink === "string")
    values.push("Static");
  if (data.private === true) values.push("Private");
  if (data.required === false) values.push("Optional");
  if (data.includeQmod === false) values.push("No QMOD");
  if (typeof data.libType === "string") values.push(data.libType);
  return values.length ? (
    <div className="badge-row">
      {values.map((value) => (
        <Badge key={value}>{value}</Badge>
      ))}
    </div>
  ) : null;
}
function ArtifactLinks({ metadata }: { metadata: AdditionalPackageMetadata }) {
  const links = [
    ["Release library", metadata.soLink],
    ["Debug library", metadata.debugSoLink],
    ["Static library", metadata.staticLink],
    ["QMOD download", metadata.modLink],
  ].filter((entry): entry is [string, string] => isHttpUrl(entry[1]));
  return links.length ? (
    <div className="link-grid">
      {links.map(([label, href]) => (
        <SmartLink href={href} key={label}>
          {label}
        </SmartLink>
      ))}
    </div>
  ) : (
    <p className="muted">
      No downloadable artifact URLs are present in this record.
    </p>
  );
}

function Overview({ detail }: { detail: PackageDetail }) {
  const { config, restoredDependencies } = detail;
  const { info, workspace, dependencies } = config;
  const metadata = info.additionalData ?? {};
  return (
    <div className="tab-stack">
      <section className="metric-grid">
        <div className="metric-card">
          <span>Package version</span>
          <strong>{info.version}</strong>
        </div>
        <div className="metric-card">
          <span>Declared dependencies</span>
          <strong>{dependencies.length}</strong>
        </div>
        <div className="metric-card">
          <span>Resolved dependencies</span>
          <strong>{restoredDependencies.length}</strong>
        </div>
        <div className="metric-card">
          <span>Android NDK</span>
          <strong title={workspace?.ndk}>
            {workspace?.ndk ?? "Not specified"}
          </strong>
        </div>
      </section>
      <section className="content-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Manifest</span>
            <h2>Package information</h2>
          </div>
          <MetadataBadges data={metadata} />
        </div>
        <dl className="field-grid">
          <Field label="Display name" value={info.name} />
          <Field label="Package ID" value={info.id} />
          <Field label="Manifest format" value={config.version} />
          <Field label="Branch" value={metadata.branchName} />
          <Field label="Shared directory" value={config.sharedDir} />
          <Field
            label="Dependencies directory"
            value={config.dependenciesDir}
          />
          <Field
            label="Library name"
            value={metadata.overrideSoName ?? metadata.overrideStaticName}
          />
          <Field label="Subfolder" value={metadata.subFolder} />
        </dl>
        {isHttpUrl(info.url) && (
          <div className="card-footer">
            <SmartLink href={info.url}>Open project repository</SmartLink>
          </div>
        )}
      </section>
      <section className="content-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Artifacts</span>
            <h2>Published downloads</h2>
          </div>
        </div>
        <ArtifactLinks metadata={metadata} />
      </section>
    </div>
  );
}
function DeclaredCard({ dependency }: { dependency: PackageDependency }) {
  return (
    <article className="dependency-card">
      <div className="dependency-title">
        <span className="dependency-icon">
          <PackageIcon />
        </span>
        <div>
          <strong>{dependency.id}</strong>
          <code>{dependency.versionRange}</code>
        </div>
      </div>
      <MetadataBadges data={dependency.additionalData ?? {}} />
    </article>
  );
}
function ResolvedCard({ item }: { item: RestoredDependency }) {
  return (
    <article className="dependency-card">
      <div className="dependency-title">
        <span className="dependency-icon dependency-icon-resolved">
          <LinkIcon />
        </span>
        <div>
          <strong>{item.dependency.id}</strong>
          <code>{item.version}</code>
        </div>
      </div>
      <div className="dependency-meta">
        <span>Requested {item.dependency.versionRange}</span>
        <MetadataBadges data={item.dependency.additionalData ?? {}} />
      </div>
    </article>
  );
}
function Dependencies({ detail }: { detail: PackageDetail }) {
  const declared = detail.config.dependencies ?? [];
  const restored = detail.restoredDependencies ?? [];
  return (
    <div className="dependency-columns">
      <section className="content-card dependency-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Requested</span>
            <h2>Declared dependencies</h2>
          </div>
          <Badge>{declared.length}</Badge>
        </div>
        {declared.length ? (
          <div className="dependency-list">
            {declared.map((item, i) => (
              <DeclaredCard dependency={item} key={`${item.id}-${i}`} />
            ))}
          </div>
        ) : (
          <p className="empty-copy">
            This version does not declare dependencies.
          </p>
        )}
      </section>
      <section className="content-card dependency-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Resolved</span>
            <h2>Restored dependencies</h2>
          </div>
          <Badge tone="accent">{restored.length}</Badge>
        </div>
        {restored.length ? (
          <div className="dependency-list">
            {restored.map((item, i) => (
              <ResolvedCard item={item} key={`${item.dependency.id}-${i}`} />
            ))}
          </div>
        ) : (
          <p className="empty-copy">
            No resolved dependency records were published.
          </p>
        )}
      </section>
    </div>
  );
}
function StringList({ values }: { values?: string[] }) {
  return values?.length ? (
    <div className="code-chip-list">
      {values.map((value, i) => (
        <code key={`${value}-${i}`}>{value}</code>
      ))}
    </div>
  ) : (
    <span className="muted">None</span>
  );
}
function Workspace({ detail }: { detail: PackageDetail }) {
  const workspace = detail.config.workspace;
  const scripts = Object.entries(workspace?.scripts ?? {});
  const options = detail.config.info.additionalData?.compileOptions;
  return (
    <div className="tab-stack">
      <section className="content-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Build environment</span>
            <h2>Workspace settings</h2>
          </div>
        </div>
        <dl className="field-grid">
          <Field label="NDK version range" value={workspace?.ndk} />
          <Field label="QMOD output" value={workspace?.qmodOutput} />
          <Field
            label="Toolchain output"
            value={detail.config.info.additionalData?.toolchainOut}
          />
          <Field label="Config format" value={detail.config.version} />
        </dl>
        <div className="workspace-groups">
          <div>
            <h3>QMOD include directories</h3>
            <StringList values={workspace?.qmodIncludeDirs} />
          </div>
          <div>
            <h3>QMOD include files</h3>
            <StringList values={workspace?.qmodIncludeFiles} />
          </div>
        </div>
      </section>
      <section className="content-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Automation</span>
            <h2>Scripts</h2>
          </div>
          <Badge>{scripts.length}</Badge>
        </div>
        {scripts.length ? (
          <div className="script-list">
            {scripts.map(([name, commands]) => (
              <div className="script-row" key={name}>
                <strong>{name}</strong>
                <div>
                  {commands.map((command, i) => (
                    <code key={`${command}-${i}`}>{command}</code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-copy">No workspace scripts are present.</p>
        )}
      </section>
      <section className="content-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Compiler</span>
            <h2>Compile options</h2>
          </div>
        </div>
        {options ? (
          <div className="workspace-groups">
            <div>
              <h3>C flags</h3>
              <StringList values={options.cFlags ?? undefined} />
            </div>
            <div>
              <h3>C++ flags</h3>
              <StringList values={options.cppFlags ?? undefined} />
            </div>
            <div>
              <h3>Include paths</h3>
              <StringList values={options.includePaths ?? undefined} />
            </div>
            <div>
              <h3>System includes</h3>
              <StringList values={options.systemIncludes ?? undefined} />
            </div>
          </div>
        ) : (
          <p className="empty-copy">
            No package-level compile options are present.
          </p>
        )}
      </section>
    </div>
  );
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const initialPackage = params.get("package") ?? undefined;
  const initialVersion = params.get("version") ?? undefined;
  const [packages, setPackages] = useState<string[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState<string>();
  const [selectedPackage, setSelectedPackage] = useState<string>();
  const [versions, setVersions] = useState<PackageVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string>();
  const [selectedVersion, setSelectedVersion] = useState<string>();
  const [detail, setDetail] = useState<PackageDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string>();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setPackagesLoading(true);
    setPackagesError(undefined);
    getPackages(controller.signal)
      .then((items) => {
        const sorted = [...items].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" }),
        );
        setPackages(sorted);
        if (!initialized.current) {
          setSelectedPackage(
            initialPackage && sorted.includes(initialPackage)
              ? initialPackage
              : sorted[0],
          );
          initialized.current = true;
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setPackagesError(errorText(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPackagesLoading(false);
      });
    return () => controller.abort();
  }, [initialPackage, refreshKey]);

  useEffect(() => {
    if (!selectedPackage) return;
    const controller = new AbortController();
    setVersionsError(undefined);
    setDetail(undefined);
    setDetailError(undefined);
    setActiveTab("overview");
    const apply = (items: PackageVersion[]) => {
      const sorted = [...items].sort((a, b) =>
        compareVersionsDescending(a.version, b.version),
      );
      setVersions(sorted);
      const requested =
        selectedPackage === initialPackage &&
        !selectedVersion &&
        initialVersion &&
        sorted.some((x) => x.version === initialVersion)
          ? initialVersion
          : undefined;
      const next = requested ?? sorted[0]?.version;
      setSelectedVersion(next);
      updateUrl(selectedPackage, next);
    };
    const cached = versionsCache.get(selectedPackage);
    if (cached) {
      setVersionsLoading(false);
      apply(cached);
      return () => controller.abort();
    }
    setVersions([]);
    setSelectedVersion(undefined);
    setVersionsLoading(true);
    updateUrl(selectedPackage);
    getPackageVersions(selectedPackage, controller.signal)
      .then((items) => {
        versionsCache.set(selectedPackage, items);
        apply(items);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setVersionsError(errorText(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setVersionsLoading(false);
      });
    return () => controller.abort();
    // selectedVersion is deliberately excluded; version changes should not refetch the version list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPackage, initialPackage, initialVersion, refreshKey]);

  useEffect(() => {
    if (!selectedPackage || !selectedVersion) return;
    const controller = new AbortController();
    const key = `${selectedPackage}@${selectedVersion}`;
    setDetailError(undefined);
    updateUrl(selectedPackage, selectedVersion);
    const cached = detailCache.get(key);
    if (cached) {
      setDetail(cached);
      setDetailLoading(false);
      return () => controller.abort();
    }
    setDetail(undefined);
    setDetailLoading(true);
    getPackageDetail(selectedPackage, selectedVersion, controller.signal)
      .then((item) => {
        detailCache.set(key, item);
        setDetail(item);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setDetailError(errorText(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selectedPackage, selectedVersion, refreshKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? packages.filter((item) => item.toLowerCase().includes(q))
      : packages;
  }, [packages, search]);
  function selectPackage(id: string) {
    setSelectedPackage(id);
    setSelectedVersion(undefined);
    setSidebarOpen(false);
  }
  function refresh() {
    versionsCache.clear();
    detailCache.clear();
    setRefreshKey((x) => x + 1);
  }
  const title =
    detail?.config.info.name ?? selectedPackage ?? "Select a package";
  const subtitle =
    detail?.config.info.id ?? "Browse the qpackages.com registry";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <PackageIcon />
          </span>
          <div>
            <strong>QPackages Explorer</strong>
            <span>Quest package registry</span>
          </div>
        </div>
        <div className="topbar-actions">
          <span
            className="theme-indicator"
            title="Theme follows your browser preference"
          >
            <SunMoonIcon />
            System theme
          </span>
          <a
            className="button button-ghost hide-mobile"
            href="https://qpackages.com"
            target="_blank"
            rel="noreferrer"
          >
            API
            <ExternalLinkIcon />
          </a>
          <button
            className="button button-secondary"
            type="button"
            onClick={refresh}
          >
            <RefreshIcon />
            <span className="hide-mobile">Refresh</span>
          </button>
        </div>
      </header>
      <div className="mobile-package-bar">
        <button
          className="button button-secondary"
          type="button"
          onClick={() => setSidebarOpen(true)}
        >
          <PackageIcon />
          Packages
        </button>
        <div>
          <strong>{selectedPackage ?? "None selected"}</strong>
          <span>
            {versions.length
              ? pluralize(versions.length, "version")
              : "Loading versions"}
          </span>
        </div>
      </div>
      <div className="workspace-layout">
        <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <div className="sidebar-header">
            <div>
              <span className="eyebrow">Registry</span>
              <h2>Packages</h2>
            </div>
            <Badge>{packages.length}</Badge>
          </div>
          <label className="search-box">
            <SearchIcon />
            <input
              type="search"
              value={search}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setSearch(event.target.value)
              }
              placeholder="Search packages…"
              aria-label="Search packages"
            />
            {search && <span>{filtered.length}</span>}
          </label>
          <nav className="package-list" aria-label="Available packages">
            {packagesLoading && (
              <div className="sidebar-loading">Loading registry…</div>
            )}
            {packagesError && (
              <div className="sidebar-error">
                <p>{packagesError}</p>
                <button type="button" onClick={refresh}>
                  Retry
                </button>
              </div>
            )}
            {!packagesLoading && !packagesError && !filtered.length && (
              <p className="empty-copy sidebar-empty">
                No packages match “{search}”.
              </p>
            )}
            {filtered.map((id) => (
              <button
                className={`package-list-item ${id === selectedPackage ? "is-active" : ""}`}
                type="button"
                key={id}
                onClick={() => selectPackage(id)}
              >
                <span className="package-avatar">
                  {id.slice(0, 2).toUpperCase()}
                </span>
                <span title={id}>{id}</span>
                <ChevronIcon />
              </button>
            ))}
          </nav>
          <button
            className="sidebar-scrim"
            type="button"
            aria-label="Close package list"
            onClick={() => setSidebarOpen(false)}
          />
        </aside>
        <main className="main-content">
          {!selectedPackage && !packagesLoading && (
            <ErrorPanel
              message="No package is currently selected."
              onRetry={refresh}
            />
          )}{" "}
          {selectedPackage && (
            <>
              <section className="package-hero">
                <div className="hero-title-group">
                  <span className="hero-icon">
                    <PackageIcon />
                  </span>
                  <div>
                    <div className="hero-eyebrow">
                      <span className="live-dot" />
                      Live registry data
                    </div>
                    <h1>{title}</h1>
                    <p>{subtitle}</p>
                  </div>
                </div>
                <div className="hero-actions">
                  <label className="version-select-label">
                    <span>Version</span>
                    <select
                      value={selectedVersion ?? ""}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                        setSelectedVersion(event.target.value);
                        setActiveTab("overview");
                      }}
                      disabled={
                        versionsLoading ||
                        Boolean(versionsError) ||
                        !versions.length
                      }
                    >
                      {versionsLoading && <option value="">Loading…</option>}
                      {versions.map((item) => (
                        <option value={item.version} key={item.version}>
                          {item.version}
                        </option>
                      ))}
                    </select>
                  </label>
                  <a
                    className="button button-ghost"
                    href={getDirectSourceUrl(selectedPackage, selectedVersion)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source
                    <ExternalLinkIcon />
                  </a>
                </div>
              </section>
              {versionsError && (
                <ErrorPanel
                  title="Unable to load versions"
                  message={versionsError}
                  onRetry={refresh}
                />
              )}{" "}
              {!versionsError && selectedVersion && (
                <div className="tab-bar" role="tablist">
                  {tabs.map((tab) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      className={activeTab === tab.id ? "is-active" : ""}
                      onClick={() => setActiveTab(tab.id)}
                      key={tab.id}
                    >
                      {tab.id === "json" && <CodeIcon />}
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
              {detailLoading && (
                <LoadingPanel
                  label={`Loading ${selectedPackage} ${selectedVersion ?? ""}`}
                />
              )}{" "}
              {detailError && (
                <ErrorPanel
                  title="Unable to load package detail"
                  message={detailError}
                  onRetry={refresh}
                />
              )}{" "}
              {detail && !detailLoading && !detailError && (
                <div className="tab-content" role="tabpanel">
                  {activeTab === "overview" && <Overview detail={detail} />}{" "}
                  {activeTab === "dependencies" && (
                    <Dependencies detail={detail} />
                  )}{" "}
                  {activeTab === "workspace" && <Workspace detail={detail} />}{" "}
                  {activeTab === "json" && (
                    <JsonViewer
                      value={detail}
                      label={`${selectedPackage}@${selectedVersion}`}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
