/**
 * Bella Interior OS — Customer Duplicate Detection Domain Service
 * Phase B: Customer Domain Foundation
 *
 * Implements weighted scoring algorithm to detect potential duplicates
 * WITHOUT automatically merging records.
 *
 * Architectural Invariant:
 * Phone numbers are NOT unique keys and a matching phone alone
 * yields 40 points (below the 80-point review threshold).
 *
 * @module src/products/bella-interior/services/crm/customer-duplicate-detection.service
 */

import type { CustomerProfile, DuplicateCandidate } from '../../domain/crm/customer.types';

export class CustomerDuplicateDetectionService {
  public static readonly DUPLICATE_SCORE_THRESHOLD = 80;

  /**
   * Find potential duplicate candidates for a target customer against an existing pool.
   * Only compares within the same tenant.
   */
  public static findDuplicates(
    target: CustomerProfile,
    pool: readonly CustomerProfile[]
  ): readonly DuplicateCandidate[] {
    const results: DuplicateCandidate[] = [];

    for (const candidate of pool) {
      if (candidate.id === target.id) continue;
      if (candidate.tenantId !== target.tenantId) continue;
      if (candidate.profileStatus === 'merged') continue;

      const evaluation = this.evaluateSimilarity(target, candidate);
      if (evaluation.score >= this.DUPLICATE_SCORE_THRESHOLD) {
        results.push({
          candidateCustomerId: candidate.id,
          matchScore: evaluation.score,
          matchedCriteria: evaluation.criteria,
        });
      }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Calculate match score between two customer profiles.
   */
  public static evaluateSimilarity(
    a: CustomerProfile,
    b: CustomerProfile
  ): { score: number; criteria: readonly string[] } {
    let score = 0;
    const criteria: string[] = [];

    // 1. Tax Code match (Enterprise/Corporate) -> 100 pts (Definitive legal identity)
    if (a.taxCode && b.taxCode) {
      const cleanTaxA = a.taxCode.replace(/[^0-9]/g, '');
      const cleanTaxB = b.taxCode.replace(/[^0-9]/g, '');
      if (cleanTaxA.length >= 10 && cleanTaxA === cleanTaxB) {
        score += 100;
        criteria.push('exact_tax_code');
        return { score: Math.min(score, 100), criteria };
      }
    }

    // 2. Primary Phone match -> 40 pts (Important indicator, but never sufficient alone)
    if (a.primaryPhone && b.primaryPhone) {
      const cleanPhoneA = a.primaryPhone.replace(/[^0-9]/g, '');
      const cleanPhoneB = b.primaryPhone.replace(/[^0-9]/g, '');
      if (cleanPhoneA.length >= 8 && cleanPhoneA === cleanPhoneB) {
        score += 40;
        criteria.push('exact_primary_phone');
      }
    }

    // 3. Primary Email match -> 30 pts
    if (a.primaryEmail && b.primaryEmail) {
      if (a.primaryEmail.trim().toLowerCase() === b.primaryEmail.trim().toLowerCase()) {
        score += 30;
        criteria.push('exact_primary_email');
      }
    }

    // 4. Name Similarity -> Up to 40 pts
    const nameScore = this.calculateNameSimilarity(a.name, b.name);
    if (nameScore >= 0.85) {
      const points = Math.round(nameScore * 40);
      score += points;
      criteria.push(`name_similarity_${Math.round(nameScore * 100)}%`);
    }

    return {
      score: Math.min(score, 100),
      criteria,
    };
  }

  /**
   * Normalized Bigram / Dice coefficient for Vietnamese names.
   */
  public static calculateNameSimilarity(nameA: string, nameB: string): number {
    const cleanA = this.normalizeText(nameA);
    const cleanB = this.normalizeText(nameB);

    if (cleanA === cleanB) return 1.0;
    if (cleanA.length < 2 || cleanB.length < 2) return 0.0;

    const bigramsA = this.getBigrams(cleanA);
    const bigramsB = this.getBigrams(cleanB);

    let intersection = 0;
    const bCopy = [...bigramsB];

    for (const bg of bigramsA) {
      const idx = bCopy.indexOf(bg);
      if (idx !== -1) {
        intersection++;
        bCopy.splice(idx, 1);
      }
    }

    const dice = (2.0 * intersection) / (bigramsA.length + bigramsB.length);

    // Word Token Jaccard
    const wordsA = new Set(cleanA.split(' '));
    const wordsB = new Set(cleanB.split(' '));
    let wordIntersect = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) wordIntersect++;
    }
    const tokenJaccard = (wordsA.size + wordsB.size - wordIntersect) > 0
      ? wordIntersect / (wordsA.size + wordsB.size - wordIntersect)
      : 0;

    return Math.max(dice, tokenJaccard);
  }

  private static normalizeText(text: string): string {
    const raw = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Expand common business prefixes to match canonical representations
    const expanded = raw
      .split(' ')
      .map((t) => {
        switch (t) {
          case 'cty':
            return 'cong ty';
          case 'cp':
            return 'co phan';
          case 'tnhh':
            return 'trach nhiem huu han';
          case 'jsc':
            return 'co phan';
          case 'xd':
            return 'xay dung';
          case 'nt':
            return 'noi that';
          default:
            return t;
        }
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return expanded;
  }

  private static getBigrams(text: string): string[] {
    const bigrams: string[] = [];
    for (let i = 0; i < text.length - 1; i++) {
      bigrams.push(text.slice(i, i + 2));
    }
    return bigrams;
  }
}
