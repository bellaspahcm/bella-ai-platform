import { realEstateManifest } from '../../modules/real_estate/manifest';
import { bellaAutoManifest } from '../../modules/bella-auto/manifest';
import { healthcareManifest } from '../../modules/bella-healthcare/manifest';
import { bellaEducationManifest } from '../../products/bella-education/manifest';
import { bellaInteriorManifest } from '../../products/bella-interior/manifest';

export interface ProviderContext {
  readonly tenantId: string;
  readonly userId?: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly services?: Record<string, unknown>;
}

export interface ProviderMetadata {
  readonly version: string;
  readonly author?: string;
  readonly capability?: string;
}

export interface MetricValue {
  readonly metricId: string;
  readonly value: number;
}

export type OrganizationNodeKind = 'company' | 'branch' | 'team' | 'member' | string;

export interface OrganizationUnit {
  readonly id: string;
  readonly name: string;
  readonly kind: OrganizationNodeKind;
  readonly managerName?: string;
  readonly metricValues: MetricValue[];
  readonly hasChildren?: boolean;
}

export interface MetricDefinition {
  readonly id: string;
  readonly label: string;
  readonly format: 'number' | 'currency' | 'percent';
  readonly icon?: string;
  readonly color?: string;
  readonly description?: string;
  readonly aggregation?: 'sum' | 'avg' | 'count';
  readonly permission?: string;
  readonly drilldown?: boolean;
  readonly queryKey?: string;
  readonly visible?: boolean;
}

export interface OrganizationTreeProvider {
  readonly metadata: ProviderMetadata;
  getTerminology(): {
    readonly root: string;
    readonly level1: string;
    readonly level2: string;
    readonly member: string;
  };
  getRoot(): Promise<OrganizationUnit>;
  getChildren(nodeId: string): Promise<OrganizationUnit[]>;
  getNode(nodeId: string): Promise<OrganizationUnit | null>;
  getSummary(nodeId: string): Promise<MetricValue[]>;
}

export interface OrganizationMetricProvider {
  readonly metadata: ProviderMetadata;
  getMetrics(): MetricDefinition[];
}

export interface VerticalManifest {
  readonly key: string;
  readonly name: string;
  readonly version: string;
  readonly themeKey: string;
  readonly defaultRoute: string;
  readonly enabledCapabilities: string[];
  readonly menus: Array<{
    readonly id: string;
    readonly label: string;
    readonly href: string;
    readonly icon?: string;
  }>;
  readonly providers?: {
    readonly organization?: {
      readonly tree: (context: ProviderContext) => OrganizationTreeProvider;
      readonly metric: (context: ProviderContext) => OrganizationMetricProvider;
    };
    [key: string]: unknown;
  };
}

class VerticalRegistry {
  private manifests: Map<string, VerticalManifest> = new Map();

  constructor() {
    this.register(realEstateManifest);
    this.register(bellaAutoManifest);
    this.register(healthcareManifest);
    this.register(bellaEducationManifest);
    this.register(bellaInteriorManifest);
  }

  register(manifest: VerticalManifest): void {
    this.manifests.set(manifest.key, manifest);
  }

  get(key: string): VerticalManifest | undefined {
    return this.manifests.get(key);
  }

  getAll(): VerticalManifest[] {
    return Array.from(this.manifests.values());
  }

  has(key: string): boolean {
    return this.manifests.has(key);
  }
}

export const verticalRegistry = new VerticalRegistry();
