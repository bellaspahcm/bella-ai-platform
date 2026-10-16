import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { saleChainConnection } from '../src/modules/bella-auto/services/AutoMoveSaleChainConnection';
import { MobilityFoundationService, PostgresMobilityRepository } from '../src/platform/mobility';

const api = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
assert.equal(new URL(api).hostname, 'bmnbqbcdbuklhopfbopv.supabase.co');
const db = new Client(saleChainConnection(process.env.DB_URL || process.env.SUPABASE_DB_URL || '', api));
const tenant = randomUUID(), otherTenant = randomUUID(), actor = randomUUID(), other = randomUUID();
const customer = randomUUID(), foreignCustomer = randomUUID(), brand = randomUUID(), model = randomUUID(), variant = randomUUID();
async function context(id: string) {
  await db.query('reset role'); await db.query('set local role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [id]);
}
async function denied(fn: () => Promise<unknown>) {
  await db.query('savepoint denied'); let code: unknown;
  try { await fn(); } catch (error: unknown) { if (error && typeof error === 'object' && 'code' in error) code = error.code; }
  await db.query('rollback to savepoint denied'); await db.query('release savepoint denied');
  assert.equal(code, '42501');
}
async function verify() {
  await db.connect();
  try {
    await db.query('begin');
    if (process.env.VERIFY_MANAGEMENT_MIGRATION_ROLLBACK === '1') {
      await db.query(readFileSync('supabase/migrations/20261015050000_authorize_automove_customer_profile_management.sql', 'utf8'));
      await db.query(readFileSync('supabase/migrations/20261015050100_limit_automove_profile_preference_columns.sql', 'utf8'));
    }
    await db.query("set local statement_timeout='20s'");
    for (const id of [tenant, otherTenant]) await db.query("insert into public.tenants(id,name,status) values($1,'Management rollback proof','active')", [id]);
    for (const [id, owner] of [[actor,tenant],[other,otherTenant]]) {
      await db.query("insert into auth.users(id,email,aud,role) values($1,$2,'authenticated','authenticated')", [id, `${id}@example.test`]);
      await db.query("insert into public.users(id,email,full_name,tenant_id,role,status) values($1,$2,'Management proof',$3,'accountant','active')", [id, `${id}@example.test`, owner]);
    }
    for (const [id, owner] of [[customer,tenant],[foreignCustomer,otherTenant]]) await db.query('insert into public.customers(id,tenant_id,name_mother,phone) values($1,$2,$3,$4)', [id,owner,'Management proof',randomUUID()]);
    await db.query('insert into public.auto_brands(id,tenant_id,name) values($1,$2,$3)',[brand,tenant,'Management proof']);
    await db.query('insert into public.auto_models(id,tenant_id,brand_id,name) values($1,$2,$3,$4)',[model,tenant,brand,'Management proof']);
    await db.query('insert into public.auto_variants(id,tenant_id,model_id,name,year) values($1,$2,$3,$4,2026)',[variant,tenant,model,'Management proof']);
    await context(actor);
    await db.query('insert into public.auto_customer_profiles(tenant_id,customer_id,preferred_brands) values($1,$2,$3)',[tenant,customer,['BMW']]);
    await db.query('update public.auto_customer_profiles set preferred_brands=$3 where tenant_id=$1 and customer_id=$2',[tenant,customer,['Updated']]);
    assert.deepEqual((await db.query('select preferred_brands from public.auto_customer_profiles where customer_id=$1',[customer])).rows,[{preferred_brands:['Updated']}]);
    await denied(()=>db.query('update public.auto_customer_profiles set total_value_spent=1 where customer_id=$1',[customer]));
    await denied(()=>db.query('update public.auto_customer_profiles set total_vehicles_owned=1 where customer_id=$1',[customer]));
    await denied(()=>db.query("update public.auto_customer_profiles set metadata='{}' where customer_id=$1",[customer]));
    await denied(()=>db.query('delete from public.auto_customer_profiles where customer_id=$1',[customer]));
    await denied(()=>db.query('insert into public.auto_customer_profiles(tenant_id,customer_id) values($1,$2)',[tenant,foreignCustomer]));
    const repository = new PostgresMobilityRepository(db,true);
    const service = new MobilityFoundationService(repository,{ensureAllowed:async p=>assert.equal(p.tenantId,tenant)}, {next:()=>randomUUID()},{now:()=>new Date().toISOString()});
    const input={variantId:variant,vin:randomUUID().replaceAll('-','').slice(0,17).toUpperCase(),modelYear:2026,colorExterior:'White',idempotencyKey:randomUUID(),listPrice:1500000000};
    const registered=await service.registerVehicle({tenantId:tenant,userId:actor,roles:['accountant']},input);
    assert.equal((await service.registerVehicle({tenantId:tenant,userId:actor,roles:['accountant']},input)).isDuplicate,true);
    assert.equal((await repository.getVehicle(tenant,registered.value.id))?.status,'in_transit');
    assert.equal((await db.query('select count(*)::int n from public.mobility_domain_events where entity_id=$1',[registered.value.id])).rows[0].n,1);
    await context(other);
    assert.equal((await db.query('select id from public.auto_customer_profiles where customer_id=$1',[customer])).rows.length,0);
    assert.equal((await repository.getVehicle(tenant,registered.value.id)),null);
    await denied(()=>db.query('insert into public.auto_customer_profiles(tenant_id,customer_id) values($1,$2)',[tenant,customer]));
    await db.query('reset role'); await db.query("update public.users set status='inactive' where id=$1",[actor]); await context(actor);
    await denied(()=>db.query('select * from public.auto_customer_profiles where customer_id=$1',[customer]));
    await db.query('reset role'); await db.query("update public.users set status='active' where id=$1",[actor]);
    await db.query("update public.tenants set status='suspended' where id=$1",[tenant]); await context(actor);
    await denied(()=>db.query('select * from public.auto_customer_profiles where customer_id=$1',[customer]));
    await db.query('rollback');
    assert.equal((await db.query('select id from public.tenants where id=any($1::uuid[])',[[tenant,otherTenant]])).rows.length,0);
    assert.equal((await db.query('select id from auth.users where id=any($1::uuid[])',[[actor,other]])).rows.length,0);
    console.log('AUTOMOVE_MANAGEMENT_REAL_DB_RLS_REGISTRATION_RETRY=PASS_ROLLBACK_ZERO_FIXTURES');
  } finally { await db.query('rollback').catch(()=>undefined); await db.end(); }
}
verify().catch(error=>{console.error('AUTOMOVE_MANAGEMENT_VERIFIER=FAIL',error instanceof Error ? error.message:'Unknown');process.exitCode=1;});
