export interface PackageVersion { id: string; version: string }

export interface CompileOptions {
  cFlags?: string[] | null;
  cppFeatures?: string[] | null;
  cppFlags?: string[] | null;
  includePaths?: string[] | null;
  systemIncludes?: string[] | null;
  [key: string]: unknown;
}

export interface AdditionalPackageMetadata {
  branchName?: string | null;
  cmake?: boolean | null;
  compileOptions?: CompileOptions | null;
  debugSoLink?: string | null;
  headersOnly?: boolean | null;
  modLink?: string | null;
  overrideSoName?: string | null;
  overrideStaticName?: string | null;
  soLink?: string | null;
  staticLink?: string | null;
  staticLinking?: boolean | null;
  subFolder?: string | null;
  toolchainOut?: string | null;
  [key: string]: unknown;
}

export interface PackageDependencyModifier {
  extraFiles?: string[] | null;
  includeQmod?: boolean | null;
  libType?: 'shared' | 'static' | 'headerOnly' | null;
  localPath?: string | null;
  private?: boolean | null;
  required?: boolean | null;
  [key: string]: unknown;
}

export interface PackageDependency {
  id: string;
  versionRange: string;
  additionalData: PackageDependencyModifier;
  [key: string]: unknown;
}

export interface RestoredDependency {
  dependency: {
    id: string;
    versionRange: string;
    additionalData: AdditionalPackageMetadata;
    [key: string]: unknown;
  };
  version: string;
  [key: string]: unknown;
}

export interface PackageDetail {
  $schema?: string;
  config: {
    version?: string;
    sharedDir: string;
    dependenciesDir: string;
    info: {
      name: string;
      id: string;
      version: string;
      url?: string | null;
      additionalData: AdditionalPackageMetadata;
      [key: string]: unknown;
    };
    workspace?: {
      ndk?: string;
      scripts?: Record<string, string[]>;
      qmodIncludeDirs?: string[];
      qmodIncludeFiles?: string[];
      qmodOutput?: string | null;
      [key: string]: unknown;
    };
    dependencies: PackageDependency[];
    [key: string]: unknown;
  };
  restoredDependencies: RestoredDependency[];
  [key: string]: unknown;
}
