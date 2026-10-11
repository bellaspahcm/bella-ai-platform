/**
 * Integration Tests for Customer Intelligence
 * 
 * Tests the complete Customer Intelligence pipeline with real Supabase data:
 * - Materialized views return correct schema
 * - Query functions transform data correctly
 * - Service layer handles caching properly
 * - Multi-tenant isolation works
 * - RFM segmentation logic is correct
 * - Churn risk calculations match SQL
 * 
 * Note: These tests require a test database with sample data.
 * Run with: npm test -- src/services/intelligence/customer/__tests__/integration.test.ts
 * 
 * Prerequisites:
 * - Test database with materialized views created
 * - Sample tenant data seeded with customers and bookings
 * - Environment variables configured (SUPABASE_URL, SUPABASE_SERVICE_KEY)
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createServerClient } from '@/lib/supabase-server';
import { CustomerIntelligenceService } from '../service';
import { MemoryCacheService } from '../../cache/memory-cache';

// ─────────────────────────────────────────────────────────────────────────────
// Test Configuration
// ─────────────────────────────────────────────────────────────────────────────

// Skip integration tests if not in integration test environment
const SKIP_INTEGRATION_TESTS = process.env.SKIP_INTEGRATION_TESTS === 'true';

// Test tenant ID (should exist in test database)
const TEST_TENANT_ID = process.env.TEST_TENANT_ID || 'test-tenant-id';

type MaterializedViewName =
  | 'mv_customer_segments'
  | 'mv_customer_ltv'
  | 'mv_customer_activity_summary';

type MaterializedViewRow = Record<string, unknown>;

type MaterializedViewQuery = {
  select(columns: string): {
    eq(column: string, value: string): {
      limit(count: number): {
        single(): Promise<{
          data: MaterializedViewRow | null;
          error: { code?: string; message: string } | null;
        }>;
      };
    };
  };
};

type MaterializedViewClient = {
  from(viewName: MaterializedViewName): MaterializedViewQuery;
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe.skip('Customer Intelligence Integration Tests', () => {
  let service: CustomerIntelligenceService;
  let supabase: ReturnType<typeof createServerClient>;

  beforeAll(async () => {
    if (SKIP_INTEGRATION_TESTS) {
      console.log('⚠️  Skipping integration tests (SKIP_INTEGRATION_TESTS=true)');
      return;
    }

    // Create service with memory cache (no Redis dependency for tests)
    const cache = new MemoryCacheService();
    service = new CustomerIntelligenceService(cache);

    // Create Supabase client
    supabase = createServerClient();

    // Verify test tenant exists
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', TEST_TENANT_ID)
      .single();

    if (error || !tenant) {
      throw new Error(
        `Test tenant ${TEST_TENANT_ID} not found. Please seed test data first.`
      );
    }

    console.log(`✓ Using test tenant: ${tenant.name} (${tenant.id})`);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Materialized View Schema Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Materialized Views Schema', () => {
    it('mv_customer_segments should have correct columns', async () => {
      const viewClient = supabase as unknown as MaterializedViewClient;
      const { data, error } = await viewClient
        .from('mv_customer_segments')
        .select('*')
        .eq('tenant_id', TEST_TENANT_ID)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (acceptable for empty tables)
        throw error;
      }

      if (data) {
        expect(data).toHaveProperty('tenant_id');
        expect(data).toHaveProperty('customer_id');
        expect(data).toHaveProperty('customer_name');
        expect(data).toHaveProperty('recency_score');
        expect(data).toHaveProperty('frequency_score');
        expect(data).toHaveProperty('monetary_score');
        expect(data).toHaveProperty('rfm_score');
        expect(data).toHaveProperty('segment');
        expect(data).toHaveProperty('retention_priority');
        expect(data).toHaveProperty('churn_risk_level');
        expect(data).toHaveProperty('recommended_action');
      }
    });

    it('mv_customer_ltv should have correct columns', async () => {
      const viewClient = supabase as unknown as MaterializedViewClient;
      const { data, error } = await viewClient
        .from('mv_customer_ltv')
        .select('*')
        .eq('tenant_id', TEST_TENANT_ID)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        expect(data).toHaveProperty('tenant_id');
        expect(data).toHaveProperty('customer_id');
        expect(data).toHaveProperty('customer_name');
        expect(data).toHaveProperty('cohort_month');
        expect(data).toHaveProperty('total_revenue');
        expect(data).toHaveProperty('predicted_ltv_12_months');
        expect(data).toHaveProperty('predicted_ltv_24_months');
        expect(data).toHaveProperty('cohort_avg_ltv');
        expect(data).toHaveProperty('value_tier');
      }
    });

    it('mv_customer_activity_summary should have correct columns', async () => {
      const viewClient = supabase as unknown as MaterializedViewClient;
      const { data, error } = await viewClient
        .from('mv_customer_activity_summary')
        .select('*')
        .eq('tenant_id', TEST_TENANT_ID)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        expect(data).toHaveProperty('tenant_id');
        expect(data).toHaveProperty('customer_id');
        expect(data).toHaveProperty('customer_name');
        expect(data).toHaveProperty('days_since_last_booking');
        expect(data).toHaveProperty('booking_frequency_change_pct');
        expect(data).toHaveProperty('revenue_change_pct');
        expect(data).toHaveProperty('recency_risk_score');
        expect(data).toHaveProperty('frequency_decline_risk_score');
        expect(data).toHaveProperty('revenue_decline_risk_score');
        expect(data).toHaveProperty('satisfaction_risk_score');
        expect(data).toHaveProperty('churn_risk_score');
        expect(data).toHaveProperty('churn_risk_level');
        expect(data).toHaveProperty('recommended_retention_actions');
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Service Method Integration Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('CustomerIntelligenceService Methods', () => {
    it('getCustomerSegmentation should return valid data', async () => {
      const result = await service.getCustomerSegmentation(TEST_TENANT_ID);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('generatedAt');
      expect(result.metadata).toHaveProperty('cacheHit');
      expect(result.metadata).toHaveProperty('queryTimeMs');

      if (result.data.length > 0) {
        const segment = result.data[0];
        expect(segment.tenantId).toBe(TEST_TENANT_ID);
        expect(typeof segment.rfmScore).toBe('number');
        expect(segment.rfmScore).toBeGreaterThanOrEqual(1);
        expect(segment.rfmScore).toBeLessThanOrEqual(4);
        expect(segment.segment).toBeDefined();
      }
    });

    it('getCustomerLTV should return valid data', async () => {
      const result = await service.getCustomerLTV(TEST_TENANT_ID);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');

      if (result.data.length > 0) {
        const ltv = result.data[0];
        expect(ltv.tenantId).toBe(TEST_TENANT_ID);
        expect(typeof ltv.totalRevenue).toBe('number');
        expect(typeof ltv.predictedLtv12Months).toBe('number');
        expect(ltv.totalRevenue).toBeGreaterThanOrEqual(0);
        expect(ltv.predictedLtv12Months).toBeGreaterThanOrEqual(0);
      }
    });

    it('getChurnRiskAnalysis should return valid data', async () => {
      const result = await service.getChurnRiskAnalysis(TEST_TENANT_ID);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');

      if (result.data.length > 0) {
        const churnRisk = result.data[0];
        expect(churnRisk.tenantId).toBe(TEST_TENANT_ID);
        expect(typeof churnRisk.churnRiskScore).toBe('number');
        expect(churnRisk.churnRiskScore).toBeGreaterThanOrEqual(0);
        expect(churnRisk.churnRiskScore).toBeLessThanOrEqual(100);
        expect(['Low', 'Medium', 'High']).toContain(churnRisk.churnRiskLevel);
        expect(Array.isArray(churnRisk.recommendedRetentionActions)).toBe(true);
      }
    });

    it('getRFMAnalysis should be alias for segmentation', async () => {
      const result = await service.getRFMAnalysis(TEST_TENANT_ID);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');

      if (result.data.length > 0) {
        const rfm = result.data[0];
        expect(rfm).toHaveProperty('recencyScore');
        expect(rfm).toHaveProperty('frequencyScore');
        expect(rfm).toHaveProperty('monetaryScore');
        expect(rfm).toHaveProperty('rfmScore');
      }
    });

    it('getSegmentDistribution should return aggregated metrics', async () => {
      const result = await service.getSegmentDistribution(TEST_TENANT_ID);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');

      if (result.data.length > 0) {
        const distribution = result.data[0];
        expect(distribution.tenantId).toBe(TEST_TENANT_ID);
        expect(typeof distribution.customerCount).toBe('number');
        expect(typeof distribution.totalRevenue).toBe('number');
        expect(typeof distribution.avgRfmScore).toBe('number');
        expect(distribution.customerCount).toBeGreaterThan(0);
      }
    });

    it('getCohortAnalysis should return retention curves', async () => {
      const result = await service.getCohortAnalysis(TEST_TENANT_ID);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');

      if (result.data.length > 0) {
        const cohort = result.data[0];
        expect(cohort.tenantId).toBe(TEST_TENANT_ID);
        expect(typeof cohort.cohortSize).toBe('number');
        expect(typeof cohort.retentionRatePct).toBe('number');
        expect(cohort.retentionRatePct).toBeGreaterThanOrEqual(0);
        expect(cohort.retentionRatePct).toBeLessThanOrEqual(100);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Caching Behavior Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Cache Behavior', () => {
    it('should cache results on first call', async () => {
      // Clear cache first
      await service.clearCache(TEST_TENANT_ID);

      // First call - should hit database
      const result1 = await service.getCustomerSegmentation(TEST_TENANT_ID);
      expect(result1.metadata.cacheHit).toBe(false);

      // Second call - should hit cache
      const result2 = await service.getCustomerSegmentation(TEST_TENANT_ID);
      expect(result2.metadata.cacheHit).toBe(true);

      // Results should be identical
      expect(result2.data).toEqual(result1.data);
    });

    it('should clear cache when requested', async () => {
      // Populate cache
      await service.getCustomerSegmentation(TEST_TENANT_ID);

      // Clear cache
      await service.clearCache(TEST_TENANT_ID);

      // Next call should hit database again
      const result = await service.getCustomerSegmentation(TEST_TENANT_ID);
      expect(result.metadata.cacheHit).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Multi-Tenant Isolation Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Multi-Tenant Isolation', () => {
    it('should only return data for requested tenant', async () => {
      const result = await service.getCustomerSegmentation(TEST_TENANT_ID);

      result.data.forEach((item) => {
        expect(item.tenantId).toBe(TEST_TENANT_ID);
      });
    });

    it('should not leak data between tenants in cache', async () => {
      const tenant1Id = TEST_TENANT_ID;
      const tenant2Id = 'different-tenant-id';

      // Fetch for tenant 1
      const result1 = await service.getCustomerSegmentation(tenant1Id);

      // Fetch for tenant 2 (may fail if tenant doesn't exist, that's OK)
      try {
        const result2 = await service.getCustomerSegmentation(tenant2Id);
        
        // If both succeed, verify data is different
        if (result1.data.length > 0 && result2.data.length > 0) {
          expect(result1.data[0].tenantId).not.toBe(result2.data[0].tenantId);
        }
      } catch (error) {
        // Tenant 2 may not exist, that's acceptable
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Data Quality Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Data Quality', () => {
    it('RFM scores should be within valid range (1-4)', async () => {
      const result = await service.getCustomerSegmentation(TEST_TENANT_ID);

      result.data.forEach((segment) => {
        expect(segment.recencyScore).toBeGreaterThanOrEqual(1);
        expect(segment.recencyScore).toBeLessThanOrEqual(4);
        expect(segment.frequencyScore).toBeGreaterThanOrEqual(1);
        expect(segment.frequencyScore).toBeLessThanOrEqual(4);
        expect(segment.monetaryScore).toBeGreaterThanOrEqual(1);
        expect(segment.monetaryScore).toBeLessThanOrEqual(4);
        expect(segment.rfmScore).toBeGreaterThanOrEqual(1);
        expect(segment.rfmScore).toBeLessThanOrEqual(4);
      });
    });

    it('RFM score should be average of R, F, M scores', async () => {
      const result = await service.getCustomerSegmentation(TEST_TENANT_ID);

      result.data.forEach((segment) => {
        const expectedRfm = 
          (segment.recencyScore + segment.frequencyScore + segment.monetaryScore) / 3;
        
        // Allow small rounding differences
        const difference = Math.abs(segment.rfmScore - expectedRfm);
        expect(difference).toBeLessThan(0.1);
      });
    });

    it('churn risk scores should be within valid range (0-100)', async () => {
      const result = await service.getChurnRiskAnalysis(TEST_TENANT_ID);

      result.data.forEach((churnRisk) => {
        expect(churnRisk.churnRiskScore).toBeGreaterThanOrEqual(0);
        expect(churnRisk.churnRiskScore).toBeLessThanOrEqual(100);
        expect(churnRisk.recencyRiskScore).toBeGreaterThanOrEqual(0);
        expect(churnRisk.recencyRiskScore).toBeLessThanOrEqual(100);
        expect(churnRisk.frequencyDeclineRiskScore).toBeGreaterThanOrEqual(0);
        expect(churnRisk.frequencyDeclineRiskScore).toBeLessThanOrEqual(100);
        expect(churnRisk.revenueDeclineRiskScore).toBeGreaterThanOrEqual(0);
        expect(churnRisk.revenueDeclineRiskScore).toBeLessThanOrEqual(100);
        expect(churnRisk.satisfactionRiskScore).toBeGreaterThanOrEqual(0);
        expect(churnRisk.satisfactionRiskScore).toBeLessThanOrEqual(100);
      });
    });

    it('churn risk level should match score thresholds', async () => {
      const result = await service.getChurnRiskAnalysis(TEST_TENANT_ID);

      result.data.forEach((churnRisk) => {
        if (churnRisk.churnRiskScore >= 70) {
          expect(churnRisk.churnRiskLevel).toBe('High');
        } else if (churnRisk.churnRiskScore >= 40) {
          expect(churnRisk.churnRiskLevel).toBe('Medium');
        } else {
          expect(churnRisk.churnRiskLevel).toBe('Low');
        }
      });
    });

    it('LTV predictions should be non-negative', async () => {
      const result = await service.getCustomerLTV(TEST_TENANT_ID);

      result.data.forEach((ltv) => {
        expect(ltv.totalRevenue).toBeGreaterThanOrEqual(0);
        expect(ltv.predictedLtv12Months).toBeGreaterThanOrEqual(0);
        expect(ltv.predictedLtv24Months).toBeGreaterThanOrEqual(0);
        expect(ltv.avgLtv).toBeGreaterThanOrEqual(0);
      });
    });

    it('cohort retention rate should be within valid range', async () => {
      const result = await service.getCohortAnalysis(TEST_TENANT_ID);

      result.data.forEach((cohort) => {
        expect(cohort.retentionRatePct).toBeGreaterThanOrEqual(0);
        expect(cohort.retentionRatePct).toBeLessThanOrEqual(100);
        
        // Retention rate = active customers / cohort size
        const calculatedRetention = (cohort.activeCustomers / cohort.cohortSize) * 100;
        const difference = Math.abs(cohort.retentionRatePct - calculatedRetention);
        expect(difference).toBeLessThan(0.1);
      });
    });

    it('segment distribution should sum to total customers', async () => {
      const result = await service.getSegmentDistribution(TEST_TENANT_ID);

      if (result.data.length > 0) {
        const totalCustomers = result.data.reduce(
          (sum, segment) => sum + segment.customerCount,
          0
        );
        
        expect(totalCustomers).toBeGreaterThan(0);
        
        // Verify no negative counts
        result.data.forEach((segment) => {
          expect(segment.customerCount).toBeGreaterThanOrEqual(0);
          expect(segment.totalRevenue).toBeGreaterThanOrEqual(0);
        });
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Segmentation Logic Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Segmentation Logic', () => {
    it('Champions should have high R, F, M scores', async () => {
      const result = await service.getCustomerSegmentation(TEST_TENANT_ID, 'Champions');

      result.data.forEach((champion) => {
        expect(champion.segment).toBe('Champions');
        expect(champion.recencyScore).toBeGreaterThanOrEqual(4);
        expect(champion.frequencyScore).toBeGreaterThanOrEqual(4);
        expect(champion.monetaryScore).toBeGreaterThanOrEqual(4);
      });
    });

    it('Lost customers should have very low recency score', async () => {
      const result = await service.getCustomerSegmentation(TEST_TENANT_ID, 'Lost');

      result.data.forEach((lost) => {
        expect(lost.segment).toBe('Lost');
        expect(lost.recencyScore).toBe(1);
        expect(lost.frequencyScore).toBe(1);
      });
    });

    it('At Risk customers should have low recency but moderate F, M', async () => {
      const result = await service.getCustomerSegmentation(TEST_TENANT_ID, 'At Risk');

      result.data.forEach((atRisk) => {
        expect(atRisk.segment).toBe('At Risk');
        expect(atRisk.recencyScore).toBeLessThanOrEqual(2);
        expect(atRisk.frequencyScore).toBeGreaterThanOrEqual(2);
      });
    });

    it('Recent Customers should have high R but low F, M', async () => {
      const result = await service.getCustomerSegmentation(TEST_TENANT_ID, 'Recent Customers');

      result.data.forEach((recent) => {
        expect(recent.segment).toBe('Recent Customers');
        expect(recent.recencyScore).toBeGreaterThanOrEqual(4);
        expect(recent.frequencyScore).toBeLessThanOrEqual(2);
        expect(recent.monetaryScore).toBeLessThanOrEqual(2);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Filtering Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Filtering', () => {
    it('should filter by segment correctly', async () => {
      const result = await service.getCustomerSegmentation(TEST_TENANT_ID, 'Champions');

      result.data.forEach((customer) => {
        expect(customer.segment).toBe('Champions');
      });
    });

    it('should filter by risk level correctly', async () => {
      const result = await service.getChurnRiskAnalysis(TEST_TENANT_ID, 'High');

      result.data.forEach((customer) => {
        expect(customer.churnRiskLevel).toBe('High');
        expect(customer.churnRiskScore).toBeGreaterThanOrEqual(70);
      });
    });

    it('should filter by value tier correctly', async () => {
      const result = await service.getCustomerLTV(TEST_TENANT_ID, undefined, 'VIP');

      result.data.forEach((customer) => {
        expect(customer.valueTier).toBe('VIP');
      });
    });

    it('should filter by cohort month correctly', async () => {
      const cohortMonth = '2025-01';
      const result = await service.getCustomerLTV(TEST_TENANT_ID, cohortMonth);

      result.data.forEach((customer) => {
        expect(customer.cohortMonth).toBe(cohortMonth);
      });
    });

    it('should respect limit parameter', async () => {
      const limit = 5;
      const result = await service.getCustomerSegmentation(TEST_TENANT_ID, undefined, limit);

      expect(result.data.length).toBeLessThanOrEqual(limit);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Performance Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Performance', () => {
    it('should complete segmentation query within acceptable time', async () => {
      const startTime = Date.now();
      await service.getCustomerSegmentation(TEST_TENANT_ID);
      const duration = Date.now() - startTime;

      // Should complete within 2 seconds (generous limit for CI/CD)
      expect(duration).toBeLessThan(2000);
    });

    it('should have faster cache hits than database queries', async () => {
      // Clear cache
      await service.clearCache(TEST_TENANT_ID);

      // Database query (cache miss)
      const start1 = Date.now();
      const result1 = await service.getCustomerSegmentation(TEST_TENANT_ID);
      const dbDuration = Date.now() - start1;

      expect(result1.metadata.cacheHit).toBe(false);

      // Cache hit
      const start2 = Date.now();
      const result2 = await service.getCustomerSegmentation(TEST_TENANT_ID);
      const cacheDuration = Date.now() - start2;

      expect(result2.metadata.cacheHit).toBe(true);

      // Cache should be significantly faster (at least 2x)
      expect(cacheDuration).toBeLessThan(dbDuration / 2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Error Handling Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should handle invalid tenant ID gracefully', async () => {
      const invalidTenantId = 'invalid-uuid-format';

      await expect(
        service.getCustomerSegmentation(invalidTenantId)
      ).rejects.toThrow();
    });

    it('should handle non-existent tenant gracefully', async () => {
      const nonExistentTenant = '00000000-0000-0000-0000-000000000000';

      const result = await service.getCustomerSegmentation(nonExistentTenant);

      // Should return empty array, not throw error
      expect(result.data).toEqual([]);
    });

    it('should handle invalid segment filter', async () => {
      const invalidSegment = 'InvalidSegmentName';

      const result = await service.getCustomerSegmentation(TEST_TENANT_ID, invalidSegment);

      // Should return empty array
      expect(result.data).toEqual([]);
    });

    it('should handle invalid risk level filter', async () => {
      const invalidRiskLevel =
        'InvalidRiskLevel' as Parameters<CustomerIntelligenceService['getChurnRiskAnalysis']>[1];

      const result = await service.getChurnRiskAnalysis(TEST_TENANT_ID, invalidRiskLevel);

      // Should return empty array
      expect(result.data).toEqual([]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Health Check Test
  // ───────────────────────────────────────────────────────────────────────────

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });
});
