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
export * from './adapters/platform-authorization.adapter';
export * from './adapters/platform-finance-outbox.adapter';

// Repositories
export * from './repositories/interior-repository.interface';
export * from './repositories/in-memory.repository';

// Master Service Facade
export * from './services/interior-os.service';

// Manifest
export * from './manifest';

