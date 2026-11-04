#!/usr/bin/env node
import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

const postgresUrl = process.env.DATABASE_ADMIN_URL;
if (!postgresUrl) {
  throw new Error('DATABASE_ADMIN_URL must be configured through an approved secret manager.');
}
const c = new Client({connectionString: postgresUrl});

try {
  await c.connect();
  console.log('Applying RLS protection to close Authority #3...\n');
  
  const sql = fs.readFileSync('supabase/migrations/20260820140000_enable_rls_block_service_key.sql', 'utf8');
  await c.query(sql);
  
  console.log('✅ RLS enabled on tenants table');
  console.log('✅ REST API access blocked');
  console.log('✅ Authority #3 remediation applied\n');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  await c.end();
}
