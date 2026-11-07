/**
 * Bella Interior OS — Public Module Barrel
 *
 * @module src/products/bella-interior
 */

// Bounded Context 1: Design & Specification
export * from './domain/design-specification/types';
export * from './services/design-specification.service';

// Bounded Context 2: Commercial & Costing
export * from './domain/commercial-costing/types';
export * from './services/commercial-costing.service';

// Bounded Context 3: Manufacturing & Installation
export * from './domain/manufacturing-install/types';
export * from './services/manufacturing-installation.service';

// Bounded Context 4: Project Delivery & Aftercare
export * from './domain/delivery-aftercare/types';
export * from './services/delivery-aftercare.service';

// Domain Invariants & Errors
export * from './domain/errors';
export * from './domain/events';

// Ports & Adapters
export * from './ports/interior-authorization.port';
export * from './ports/interior-outbox.port';
export * from './ports/interior-production-request.port';
export * from './adapters/platform-authorization.adapter';
export * from './adapters/platform-finance-outbox.adapter';
export * from './adapters/supabase-finance-outbox.adapter';
export * from './adapters/platform-manufacturing.adapter';

// Repositories
export * from './repositories/interior-repository.interface';
export * from './repositories/in-memory.repository';
export * from './repositories/supabase.repository';

// Server Auth Context
export * from './lib/server-context';

// Master Service Facade
export * from './services/interior-os.service';

// Portfolio Overview & Executive Analytics
export * from './domain/portfolio-overview.types';
export * from './services/interior-portfolio-analytics.service';

// Customer CRM & Investor Analytics
export * from './domain/customer-overview.types';
export * from './services/interior-customer-analytics.service';

// Schedule & Dispatch Management Analytics
export * from './domain/schedule-overview.types';
export * from './services/interior-schedule-analytics.service';

// Design Studio & Specification Analytics
export * from './domain/design-overview.types';
export * from './services/interior-design-analytics.service';

// Manifest
export * from './manifest';

