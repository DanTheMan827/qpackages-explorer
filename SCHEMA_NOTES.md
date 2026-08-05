# Detail response schema

The detail response follows the QPM `SharedPackageConfig` structure. The UI uses known fields for presentation and retains unknown fields for the Raw JSON view.

```ts
interface PackageDetail {
  $schema?: string;
  config: {
    version?: string;
    sharedDir: string;
    dependenciesDir: string;
    info: PackageMetadata;
    workspace?: WorkspaceConfig;
    dependencies: PackageDependency[];
  };
  restoredDependencies: RestoredDependency[];
}
```

Known package `additionalData` fields include `branchName`, `cmake`, `compileOptions`, `debugSoLink`, `headersOnly`, `modLink`, `overrideSoName`, `overrideStaticName`, `soLink`, `staticLink`, deprecated `staticLinking`, `subFolder`, and `toolchainOut`.

Dependency modifiers include `extraFiles`, `includeQmod`, `libType`, `localPath`, `private`, and `required`. Compile options include `cFlags`, deprecated `cppFeatures`, `cppFlags`, `includePaths`, and `systemIncludes`.

Use `npm run audit:schema` to produce an exhaustive observed-data report from the live catalog.
