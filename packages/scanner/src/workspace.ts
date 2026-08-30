import { promises as fs } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { BaoWorkspaceConfig } from "./types.js";

const MODULE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

export interface WorkspaceSource {
  relativePath: string;
  source: string;
}

interface ImportBinding {
  imported: string;
  local: string;
  namespace: boolean;
  specifier: string;
}

interface ReExport {
  exported: string;
  imported: string;
  specifier: string;
  star: boolean;
}

interface ModuleInfo {
  imports: ImportBinding[];
  localExports: Map<string, string>;
  reExports: ReExport[];
  dependencies: Set<string>;
  resolvedSpecifiers: Map<string, string>;
}

interface WorkspacePackage {
  directory: string;
  exports?: unknown;
  name: string;
}

interface TsPathRule {
  baseDirectory: string;
  configDirectory: string;
  pattern: string;
  targets: string[];
}

export class WorkspaceGraph {
  readonly forward = new Map<string, Set<string>>();
  readonly reverse = new Map<string, Set<string>>();
  readonly unresolved = new Map<string, Set<string>>();

  constructor(
    private readonly modules: Map<string, ModuleInfo>,
    unresolved: Map<string, Set<string>> = new Map(),
  ) {
    for (const file of modules.keys()) {
      this.forward.set(file, new Set(modules.get(file)?.dependencies));
      this.reverse.set(file, new Set());
    }
    for (const [file, specifiers] of unresolved) this.unresolved.set(file, new Set(specifiers));
    for (const [file, dependencies] of this.forward) {
      for (const dependency of dependencies) {
        const consumers = this.reverse.get(dependency);
        if (consumers) consumers.add(file);
      }
    }
  }

  impactedFiles(changed: Set<string>): Set<string> {
    const impacted = new Set<string>();
    const queue = Array.from(changed).filter((file) => this.modules.has(normalizePath(file)));

    while (queue.length > 0) {
      const file = normalizePath(queue.shift()!);
      if (impacted.has(file)) continue;
      impacted.add(file);
      for (const adjacent of [
        ...(this.forward.get(file) ?? []),
        ...(this.reverse.get(file) ?? []),
      ]) {
        if (!impacted.has(adjacent)) queue.push(adjacent);
      }
    }

    return impacted;
  }

  linkedBindings(importer: string, target: string, targetExports: string[]): Set<string> {
    const bindings = new Set<string>();
    const module = this.modules.get(normalizePath(importer));
    if (!module || targetExports.length === 0) return bindings;
    const expected = new Set(targetExports);

    for (const binding of module.imports) {
      const dependency = this.resolveDependency(importer, binding.specifier);
      if (!dependency) continue;
      if (binding.namespace) {
        for (const exported of expected) {
          if (this.exportReaches(dependency, exported, target, expected, new Set())) {
            bindings.add(`${binding.local}.${exported}`);
          }
        }
      } else if (this.exportReaches(dependency, binding.imported, target, expected, new Set())) {
        bindings.add(binding.local);
      }
    }

    return bindings;
  }

  hasUnresolvedImport(file: string): boolean {
    return (this.unresolved.get(normalizePath(file))?.size ?? 0) > 0;
  }

  private resolveDependency(importer: string, specifier: string): string | undefined {
    const module = this.modules.get(normalizePath(importer));
    return module?.resolvedSpecifiers.get(specifier);
  }

  private exportReaches(
    file: string,
    exportedName: string,
    target: string,
    expected: Set<string>,
    visited: Set<string>,
  ): boolean {
    const key = `${file}:${exportedName}`;
    if (visited.has(key)) return false;
    visited.add(key);

    const normalizedTarget = normalizePath(target);
    if (normalizePath(file) === normalizedTarget && expected.has(exportedName)) return true;
    const module = this.modules.get(normalizePath(file));
    if (!module) return false;

    const local = module.localExports.get(exportedName);
    if (local) {
      const imported = module.imports.find((binding) => binding.local === local);
      if (imported) {
        const dependency = this.dependencyForSpecifier(module, imported.specifier);
        if (
          dependency &&
          this.exportReaches(dependency, imported.imported, target, expected, visited)
        ) {
          return true;
        }
      }
    }

    for (const entry of module.reExports) {
      if (!entry.star && entry.exported !== exportedName) continue;
      const dependency = this.dependencyForSpecifier(module, entry.specifier);
      if (
        dependency &&
        this.exportReaches(
          dependency,
          entry.star ? exportedName : entry.imported,
          target,
          expected,
          visited,
        )
      ) {
        return true;
      }
    }

    return false;
  }

  private dependencyForSpecifier(module: ModuleInfo, specifier: string): string | undefined {
    return module.resolvedSpecifiers.get(specifier);
  }
}

export async function buildWorkspaceGraph(
  root: string,
  sources: WorkspaceSource[],
  config?: BaoWorkspaceConfig,
): Promise<WorkspaceGraph> {
  const sourceFiles = new Set(sources.map((entry) => normalizePath(entry.relativePath)));
  const roots = await discoverWorkspaceRoots(root, config);
  const packages = await readWorkspacePackages(root, roots);
  const tsPathRules = await readTsPathRules(root, config, roots);
  const modules = new Map<string, ModuleInfo>();
  const unresolved = new Map<string, Set<string>>();

  for (const record of sources) {
    const file = normalizePath(record.relativePath);
    const parsed = parseModule(file, record.source);
    const dependencies = new Set<string>();
    const resolvedSpecifiers = new Map<string, string>();
    const specifiers = new Set([
      ...parsed.imports.map((entry) => entry.specifier),
      ...parsed.reExports.map((entry) => entry.specifier),
    ]);

    for (const specifier of specifiers) {
      const resolved = resolveSpecifier(root, file, specifier, sourceFiles, packages, tsPathRules);
      if (resolved) {
        dependencies.add(resolved);
        resolvedSpecifiers.set(specifier, resolved);
      } else if (isBoundedSpecifier(specifier, packages, tsPathRules)) {
        const entries = unresolved.get(file) ?? new Set<string>();
        entries.add(specifier);
        unresolved.set(file, entries);
      }
    }

    parsed.dependencies = dependencies;
    parsed.resolvedSpecifiers = resolvedSpecifiers;
    modules.set(file, parsed);
  }

  return new WorkspaceGraph(modules, unresolved);
}

function parseModule(file: string, source: string): ModuleInfo {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file),
  );
  const imports: ImportBinding[] = [];
  const localExports = new Map<string, string>();
  const reExports: ReExport[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      if (statement.importClause?.name) {
        imports.push({
          imported: "default",
          local: statement.importClause.name.text,
          namespace: false,
          specifier,
        });
      }
      const named = statement.importClause?.namedBindings;
      if (named && ts.isNamespaceImport(named)) {
        imports.push({ imported: "*", local: named.name.text, namespace: true, specifier });
      } else if (named) {
        for (const element of named.elements) {
          imports.push({
            imported: element.propertyName?.text ?? element.name.text,
            local: element.name.text,
            namespace: false,
            specifier,
          });
        }
      }
    }

    if (ts.isExportDeclaration(statement)) {
      const specifier =
        statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : undefined;
      if (!statement.exportClause) {
        if (specifier) reExports.push({ exported: "*", imported: "*", specifier, star: true });
      } else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          const exported = element.name.text;
          const imported = element.propertyName?.text ?? exported;
          if (specifier) reExports.push({ exported, imported, specifier, star: false });
          else localExports.set(exported, imported);
        }
      }
    }

    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
        if (statement.name) localExports.set(statement.name.text, statement.name.text);
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name))
            localExports.set(declaration.name.text, declaration.name.text);
        }
      }
      if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) {
        localExports.set("default", "default");
      }
    }
    if (ts.isExportAssignment(statement)) localExports.set("default", "default");
  }

  return {
    imports,
    localExports,
    reExports,
    dependencies: new Set(),
    resolvedSpecifiers: new Map(),
  };
}

async function discoverWorkspaceRoots(
  root: string,
  config?: BaoWorkspaceConfig,
): Promise<string[]> {
  if (config?.roots) return validatePatterns(config.roots, root, "workspace.roots");
  const patterns = new Set<string>();
  const manifest = await readJson(path.join(root, "package.json"), true);
  const workspaces = manifest?.workspaces;
  if (Array.isArray(workspaces))
    for (const entry of workspaces) if (typeof entry === "string") patterns.add(entry);
  if (workspaces && typeof workspaces === "object" && !Array.isArray(workspaces)) {
    const packages = (workspaces as Record<string, unknown>).packages;
    if (Array.isArray(packages))
      for (const entry of packages) if (typeof entry === "string") patterns.add(entry);
  }

  const pnpmFile = path.join(root, "pnpm-workspace.yaml");
  const yamlSource = await fs.readFile(pnpmFile, "utf8").catch(() => undefined);
  if (yamlSource !== undefined) {
    for (const entry of parsePnpmWorkspacePackages(yamlSource)) patterns.add(entry);
  }

  return validatePatterns(Array.from(patterns), root, "workspace roots");
}

function parsePnpmWorkspacePackages(source: string): string[] {
  const lines = source.split(/\r?\n/);
  const packages: string[] = [];
  let inPackages = false;
  let packagesIndent = -1;

  for (const rawLine of lines) {
    const withoutComment = rawLine.replace(/\s+#.*$/, "");
    if (!withoutComment.trim()) continue;
    const indent = withoutComment.length - withoutComment.trimStart().length;
    const trimmed = withoutComment.trim();
    if (!inPackages) {
      const inline = trimmed.match(/^packages\s*:\s*\[(.*)\]\s*$/);
      if (inline) {
        const values = inline[1].trim();
        if (!values) return packages;
        for (const item of values.split(",")) {
          const value = item.trim().replace(/^(?:'([^']*)'|"([^"]*)")$/, "$1$2");
          if (!value || ["[", "]", "{", "}", ":"].some((token) => value.includes(token))) {
            throw new Error("pnpm-workspace.yaml packages must contain plain string paths.");
          }
          packages.push(value);
        }
        return packages;
      }
      if (/^packages\s*:\s*$/.test(trimmed)) {
        inPackages = true;
        packagesIndent = indent;
      } else if (/^packages\s*:/.test(trimmed)) {
        throw new Error("pnpm-workspace.yaml packages must be a YAML string array.");
      }
      continue;
    }
    if (indent <= packagesIndent && !trimmed.startsWith("-")) break;
    const match = trimmed.match(/^-\s+(.+)$/);
    if (!match) throw new Error("pnpm-workspace.yaml packages must be a YAML string array.");
    const value = match[1].trim().replace(/^(?:'([^']*)'|"([^"]*)")$/, "$1$2");
    if (!value || ["[", "]", "{", "}"].some((token) => value.includes(token))) {
      throw new Error("pnpm-workspace.yaml packages must contain plain string paths.");
    }
    packages.push(value);
  }

  if (!inPackages) return [];
  return packages;
}

async function readWorkspacePackages(
  root: string,
  patterns: string[],
): Promise<WorkspacePackage[]> {
  const manifests = await collectNamedFiles(root, "package.json");
  const matchers = patterns.filter((pattern) => !pattern.startsWith("!")).map(globRegex);
  const exclusions = patterns
    .filter((pattern) => pattern.startsWith("!"))
    .map((pattern) => globRegex(pattern.slice(1)));
  const packages: WorkspacePackage[] = [];
  const names = new Map<string, string>();

  for (const manifestPath of manifests) {
    const directory = normalizePath(path.relative(root, path.dirname(manifestPath))) || ".";
    if (
      directory !== "." &&
      (matchers.length === 0 ||
        !matchers.some((matcher) => matcher.test(directory)) ||
        exclusions.some((matcher) => matcher.test(directory)))
    )
      continue;
    const manifest = await readJson(manifestPath, true);
    if (typeof manifest?.name !== "string") continue;
    const previous = names.get(manifest.name);
    if (previous && previous !== directory) {
      throw new Error(
        `Duplicate workspace package name ${manifest.name}: ${previous}, ${directory}.`,
      );
    }
    names.set(manifest.name, directory);
    packages.push({ directory, exports: manifest.exports, name: manifest.name });
  }

  return packages.sort((left, right) => right.name.length - left.name.length);
}

async function readTsPathRules(
  root: string,
  config: BaoWorkspaceConfig | undefined,
  workspaceRoots: string[],
): Promise<TsPathRule[]> {
  let configFiles: string[];
  if (config?.tsconfig) {
    const patterns = validatePatterns(config.tsconfig, root, "workspace.tsconfig");
    const allConfigs = await collectTsConfigs(root);
    const matchers = patterns.map(globRegex);
    configFiles = allConfigs.filter((file) =>
      matchers.some((matcher) => matcher.test(normalizePath(path.relative(root, file)))),
    );
  } else {
    configFiles = await collectTsConfigs(root);
  }

  const rules: TsPathRule[] = [];
  const visitedConfigs = new Set<string>();
  for (let configIndex = 0; configIndex < configFiles.length; configIndex += 1) {
    const configFile = configFiles[configIndex];
    const normalizedConfig = normalizePath(configFile);
    if (visitedConfigs.has(normalizedConfig)) continue;
    visitedConfigs.add(normalizedConfig);
    const source = await fs.readFile(configFile, "utf8");
    const parsed = ts.parseConfigFileTextToJson(normalizePath(configFile), source);
    if (parsed.error)
      throw new Error(`Invalid tsconfig ${normalizePath(path.relative(root, configFile))}.`);
    const references = parsed.config?.references;
    if (Array.isArray(references)) {
      for (const reference of references) {
        const referencePath =
          reference && typeof reference === "object"
            ? (reference as Record<string, unknown>).path
            : undefined;
        if (typeof referencePath !== "string") {
          throw new Error(
            `${normalizePath(path.relative(root, configFile))} references must contain string paths.`,
          );
        }
        const candidate = path.resolve(path.dirname(configFile), referencePath);
        const target = path.extname(candidate) ? candidate : path.join(candidate, "tsconfig.json");
        if (!isInside(root, target)) {
          throw new Error("tsconfig references must stay inside the scan root.");
        }
        if (
          await fs.stat(target).then(
            (stat) => stat.isFile(),
            () => false,
          )
        )
          configFiles.push(target);
      }
    }
    const compilerOptions = parsed.config?.compilerOptions;
    if (!compilerOptions || typeof compilerOptions !== "object") continue;
    const configDirectory = path.dirname(configFile);
    const baseDirectory = path.resolve(
      configDirectory,
      typeof compilerOptions.baseUrl === "string" ? compilerOptions.baseUrl : ".",
    );
    const paths = compilerOptions.paths;
    if (!paths || typeof paths !== "object" || Array.isArray(paths)) continue;
    for (const [pattern, targets] of Object.entries(paths)) {
      if (!Array.isArray(targets) || !targets.every((target) => typeof target === "string")) {
        throw new Error(
          `${normalizePath(path.relative(root, configFile))} compilerOptions.paths.${pattern} must be an array of strings.`,
        );
      }
      rules.push({ baseDirectory, configDirectory, pattern, targets: targets as string[] });
    }
  }

  void workspaceRoots;
  return rules.sort((left, right) => right.configDirectory.length - left.configDirectory.length);
}

function resolveSpecifier(
  root: string,
  importer: string,
  specifier: string,
  sourceFiles: Set<string>,
  packages: WorkspacePackage[],
  rules: TsPathRule[],
): string | undefined {
  if (specifier.startsWith(".")) {
    return resolveModuleCandidate(
      path.posix.join(path.posix.dirname(importer), specifier),
      sourceFiles,
    );
  }

  for (const rule of rules) {
    const importerDirectory = path.dirname(path.resolve(root, importer));
    const relativeToConfig = path.relative(rule.configDirectory, importerDirectory);
    if (
      rule.configDirectory !== root &&
      (relativeToConfig.startsWith("..") || path.isAbsolute(relativeToConfig))
    ) {
      continue;
    }
    const capture = matchAlias(rule.pattern, specifier);
    if (capture === undefined) continue;
    for (const target of rule.targets) {
      const candidate = target.replace("*", capture);
      const relative = normalizePath(
        path.relative(root, path.resolve(rule.baseDirectory, candidate)),
      );
      if (relative.startsWith("../") || path.isAbsolute(relative)) continue;
      const resolved = resolveModuleCandidate(relative, sourceFiles);
      if (resolved) return resolved;
    }
  }

  const workspace = packages.find(
    (entry) => specifier === entry.name || specifier.startsWith(`${entry.name}/`),
  );
  if (!workspace) return undefined;
  const subpath = specifier === workspace.name ? "" : specifier.slice(workspace.name.length + 1);
  const candidates = workspaceExportCandidates(workspace, subpath);
  for (const candidate of candidates) {
    const resolved = resolveModuleCandidate(candidate, sourceFiles);
    if (resolved) return resolved;
  }
  return undefined;
}

function workspaceExportCandidates(workspace: WorkspacePackage, subpath: string): string[] {
  const base = workspace.directory === "." ? "" : `${workspace.directory}/`;
  const candidates = new Set<string>();
  const add = (target: string): void => {
    const normalized = target.replace(/^\.\//, "");
    candidates.add(`${base}${normalized}`);
    if (normalized.startsWith("dist/")) candidates.add(`${base}src/${normalized.slice(5)}`);
  };
  collectExportTargets(workspace.exports, subpath ? `./${subpath}` : ".", add);
  if (subpath) {
    add(`src/${subpath}`);
    add(subpath);
  } else {
    add("src/index");
    add("index");
  }
  return Array.from(candidates);
}

function collectExportTargets(value: unknown, key: string, add: (target: string) => void): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectExportTargets(entry, key, add);
    return;
  }
  if (typeof value === "string") {
    if (key === ".") add(value);
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const object = value as Record<string, unknown>;
  if (object[key] !== undefined) collectExportTargets(object[key], ".", add);
  for (const [exportKey, exportValue] of Object.entries(object)) {
    const capture = matchAlias(exportKey, key);
    if (capture === undefined || !exportKey.includes("*")) continue;
    collectExportTargets(replaceExportCapture(exportValue, capture), ".", add);
  }
  for (const condition of ["source", "types", "import", "default", "node", "require"]) {
    if (object[condition] !== undefined) collectExportTargets(object[condition], ".", add);
  }
}

function replaceExportCapture(value: unknown, capture: string): unknown {
  if (typeof value === "string") return value.replaceAll("*", capture);
  if (Array.isArray(value)) return value.map((entry) => replaceExportCapture(entry, capture));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      replaceExportCapture(entry, capture),
    ]),
  );
}

function resolveModuleCandidate(candidate: string, sourceFiles: Set<string>): string | undefined {
  const normalized = normalizePath(path.posix.normalize(candidate)).replace(/^\.\//, "");
  const withoutExtension = normalized.replace(/\.(?:[cm]?[jt]sx?)$/, "");
  const variants = [normalized, withoutExtension];
  for (const base of variants) {
    if (sourceFiles.has(base)) return base;
    for (const extension of MODULE_EXTENSIONS) {
      if (sourceFiles.has(`${base}${extension}`)) return `${base}${extension}`;
      if (sourceFiles.has(`${base}/index${extension}`)) return `${base}/index${extension}`;
    }
  }
  return undefined;
}

function isBoundedSpecifier(
  specifier: string,
  packages: WorkspacePackage[],
  rules: TsPathRule[],
): boolean {
  return (
    specifier.startsWith(".") ||
    packages.some((entry) => specifier === entry.name || specifier.startsWith(`${entry.name}/`)) ||
    rules.some((rule) => matchAlias(rule.pattern, specifier) !== undefined)
  );
}

function matchAlias(pattern: string, specifier: string): string | undefined {
  const star = pattern.indexOf("*");
  if (star < 0) return pattern === specifier ? "" : undefined;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  return specifier.startsWith(prefix) && specifier.endsWith(suffix)
    ? specifier.slice(prefix.length, specifier.length - suffix.length)
    : undefined;
}

async function collectNamedFiles(root: string, name: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if ([".git", ".next", ".turbo", "coverage", "dist", "node_modules"].includes(entry.name))
        continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile() && entry.name === name) files.push(target);
      if (files.length > 5_000) throw new Error("Workspace discovery exceeds the 5000 file limit.");
    }
  }
  await visit(root);
  return files.sort();
}

async function collectTsConfigs(root: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if ([".git", ".next", ".turbo", "coverage", "dist", "node_modules"].includes(entry.name))
        continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile() && /^tsconfig(?:\.[^.]+)*\.json$/.test(entry.name))
        files.push(target);
      if (files.length > 5_000) throw new Error("Workspace discovery exceeds the 5000 file limit.");
    }
  }
  await visit(root);
  return files.sort();
}

async function readJson(
  file: string,
  strict: boolean,
): Promise<Record<string, unknown> | undefined> {
  const source = await fs.readFile(file, "utf8").catch(() => undefined);
  if (source === undefined) return undefined;
  try {
    return JSON.parse(source) as Record<string, unknown>;
  } catch (error) {
    if (!strict) return undefined;
    throw new Error(
      `${normalizePath(file)} is invalid JSON: ${error instanceof Error ? error.message : error}`,
    );
  }
}

function validatePatterns(patterns: string[], root: string, field: string): string[] {
  return patterns.map((pattern) => {
    const pathPattern = pattern.startsWith("!") ? pattern.slice(1) : pattern;
    if (
      !pathPattern ||
      path.isAbsolute(pathPattern) ||
      normalizePath(pathPattern).split("/").includes("..")
    ) {
      throw new Error(`${field} entries must be relative paths inside the scan root.`);
    }
    const resolved = path.resolve(root, pathPattern.replace(/[?*].*$/, ""));
    if (!isInside(root, resolved))
      throw new Error(`${field} entries must stay inside the scan root.`);
    return normalizePath(pattern).replace(/^\.\//, "").replace(/\/$/, "");
  });
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function globRegex(pattern: string): RegExp {
  let expression = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    const next = pattern[index + 1];
    if (character === "*" && next === "*") {
      expression += ".*";
      index += 1;
    } else if (character === "*") expression += "[^/]*";
    else expression += character.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`${expression}$`);
}

function normalizePath(file: string): string {
  return file.replaceAll("\\", "/").replace(/^\.\//, "");
}

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs"))
    return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}
