/**
 * Debug endpoint to verify Redis caching works
 * 
 * Test: https://bellaspa-erp.vercel.app/api/debug-redis
 */

import { getCache, setCache, deleteCache } from '@/lib/redis-cache';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Forbidden', { status: 403 });
  }
  const testKey = 'debug:test';
  const testValue = {
    timestamp: new Date().toISOString(),
    message: 'Redis cache is working!',
    random: randomUUID(),
  };

  try {
    // Test 1: Write to cache
    const writeResult = await setCache(testKey, testValue, 60);

    // Test 2: Read from cache
    const readResult = await getCache<typeof testValue>(testKey);

    // Test 3: Delete from cache
    const deleteResult = await deleteCache(testKey);

    return NextResponse.json({
      status: 'OK',
      tests: {
        write: writeResult ? 'PASS' : 'FAIL',
        read: readResult ? 'PASS' : 'FAIL',
        delete: deleteResult ? 'PASS' : 'FAIL',
      },
      data: {
        written: testValue,
        read: readResult,
      },
      environment: {
        hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        redisUrlPrefix: process.env.UPSTASH_REDIS_REST_URL?.substring(0, 30),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: {
          hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
          hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        },
      },
      { status: 500 }
    );
  }
}
