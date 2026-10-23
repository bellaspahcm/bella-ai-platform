import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { AutoMoveSaleChainService, object, type DocumentDownload } from '../src/modules/bella-auto/services/AutoMoveSaleChainService';
import { executeSaleChainAction, createSaleChainBearerClient } from '../src/modules/bella-auto/services/AutoMoveSaleChainHttp';
import { saleChainConnection } from '../src/modules/bella-auto/services/AutoMoveSaleChainConnection';
import { MobilityFoundationService, PostgresMobilityRepository } from '../src/platform/mobility';
import { createServer } from 'node:http';
import { createServerClient } from '@supabase/ssr';
import { build } from 'esbuild';
import { chromium, type Browser } from '@playwright/test';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { mkdirSync } from 'node:fs';
import { VehicleSaleRecognitionError } from '../src/modules/bella-auto/services/VehicleSaleRecognitionService';
import { AutoMoveSettlementService } from '../src/modules/bella-auto/services/AutoMoveSettlementService';
import type { SaleChainAction } from '../src/modules/bella-auto/services/AutoMoveSaleChainHttp';

// Business expectations come from the owner-approved snapshot/approval contract.
// Actual Storage/Auth are used; business fixtures are rolled back, uploaded files
// and temporary authentication/profile fixtures are explicitly removed afterward.
const localEnvPath = ['.env.e2e', 'D:/Antigravity/Projects/BELLA SPA ERP/.env.e2e'].find(path => existsSync(path));
const env = { ...(localEnvPath ? parse(readFileSync(localEnvPath)) : {}), ...process.env };
const dbUrl = process.env.DB_URL || process.env.SUPABASE_DB_URL || env.DB_URL || env.SUPABASE_DB_URL || '';
const apiUrl = env.NEXT_PUBLIC_SUPABASE_URL || '';
const expectedRef = 'bmnbqbcdbuklhopfbopv';
if (new URL(apiUrl).hostname !== `${expectedRef}.supabase.co`) {
  throw new Error('This verifier requires the authorized non-Production E2E project.');
}
const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!publicKey || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('E2E Auth/Storage credentials are required.');
const admin = createClient(apiUrl, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const authenticated = createClient(apiUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new Client(saleChainConnection(dbUrl,apiUrl));
const tenantA = randomUUID(), tenantB = randomUUID();
const customerId = randomUUID(), brandId = randomUUID(), modelId = randomUUID(), variantId = randomUUID();
const vehicleId = randomUUID(), bookingId = randomUUID();
const bucket = 'automove-sale-documents';
const paths = [`${tenantA}/${randomUUID()}.pdf`, `${tenantA}/${randomUUID()}.pdf`];
const outsidePath = `${tenantB}/${randomUUID()}.pdf`;
const cleanupPaths = [...paths,outsidePath];
const bytes = Buffer.from('%PDF-1.4\nAutoMove E2E source evidence fixture\n%%EOF\n');
const checksum = createHash('sha256').update(bytes).digest('hex');
let actorId: string | undefined;
let inBusinessTransaction = false;
let headerCreated = false;
let primaryFailure: unknown;
let connectionFailure: Error | undefined;
db.on('error', error => { connectionFailure = error; });

const download: DocumentDownload = async document => {
  const result = await authenticated.storage.from(document.bucket).download(document.path);
  if (result.error || !result.data) throw new Error('DOCUMENT_UNAVAILABLE');
  return new Uint8Array(await result.data.arrayBuffer());
};
async function context(userId: string) {
  await db.query('set local role authenticated');
  await db.query('set local row_security=on');
  await db.query("select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role','authenticated',true)",[userId]);
}
async function rejected(operation: () => Promise<unknown>, expected: RegExp | { code: string }) {
  await db.query('savepoint negative_case');
  try {
    await assert.rejects(operation, expected);
  } catch (error: unknown) {
    primaryFailure = error;
    throw error;
  } finally {
    await db.query('rollback to savepoint negative_case');
    await db.query('release savepoint negative_case');
  }
}

async function browserProof(email: string, password: string) {
  const bundle = await build({ write:false,bundle:true,platform:'browser',format:'iife',jsx:'automatic',
    stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client';
      import {VehicleSaleChainDialog} from './src/components/bella-auto/VehicleSaleChainDialog';
      import {createClient} from './src/lib/supabase-client';
      globalThis.automoveLogin = (email,password) => createClient().auth.signInWithPassword({email,password});
      globalThis.automoveOpen = () => createRoot(document.getElementById('root')).render(
        <VehicleSaleChainDialog bookingId='${bookingId}' tenantId='${tenantA}' bookingNumber='E2E Sale' onClose={()=>{}}/>);`,
      resolveDir:process.cwd(),loader:'tsx'},
    define:{'process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify(apiUrl),
      'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':JSON.stringify(publicKey),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':JSON.stringify(publicKey),
      'process.env.NODE_ENV':JSON.stringify('development')},
  });
  const css = await postcss([tailwind({base:process.cwd()})]).process('@import "tailwindcss";',{from:'src/app/automove-proof.css'});
  // The rollback browser harness shares one SQL transaction across requests.
  let requestQueue = Promise.resolve();
  const server = createServer(async (request,response) => {
    const url = new URL(request.url || '/','http://127.0.0.1');
    if (url.pathname === '/bundle.js') { response.setHeader('Content-Type','application/javascript'); response.end(bundle.outputFiles[0].text); return; }
    if (url.pathname === '/style.css') { response.setHeader('Content-Type','text/css'); response.end(css.css); return; }
    if (!url.pathname.startsWith('/api/bella-auto/sales-chain/')) {
      response.setHeader('Content-Type','text/html'); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');return;
    }
    const cookieClient = createServerClient(apiUrl,publicKey || '',{cookies:{
      getAll:()=> (request.headers.cookie || '').split(';').filter(Boolean).map(cookie=>{
        const index=cookie.indexOf('='); return {name:cookie.slice(0,index).trim(),value:decodeURIComponent(cookie.slice(index+1))};
      }),setAll:()=>undefined,
    }});
    const bearer = request.headers.authorization;
    const requestClient = bearer ? createSaleChainBearerClient(bearer,apiUrl,publicKey || '') : cookieClient;
    const identity = await requestClient.auth.getUser(bearer?.slice(7));
    if (!identity.data.user || identity.error) { response.writeHead(401,{'Content-Type':'application/json'});response.end(JSON.stringify({error:'Unauthorized'}));return; }
    const previousRequest = requestQueue;
    let releaseRequest: () => void = () => undefined;
    requestQueue = new Promise<void>(resolve => { releaseRequest = resolve; });
    await previousRequest;
    let savepoint = false;
    try {
      const action = url.pathname.split('/').at(-1);
      if (action !== 'state' && action !== 'snapshot' && action !== 'draft-update' && action !== 'approve' && action !== 'handover' && action !== 'recognize') throw new Error('Unknown action');
      const chunks: Buffer[]=[];for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const payload: unknown = action === 'state' ? url.searchParams.get('bookingId') : JSON.parse(Buffer.concat(chunks).toString('utf8'));
      await db.query('savepoint browser_request');savepoint=true;
      await context(identity.data.user.id);
      const result=await executeSaleChainAction({action:action satisfies SaleChainAction,payload,actorUserId:identity.data.user.id,db,
        download:async document=>{
          const result=await requestClient.storage.from(document.bucket).download(document.path);
          if(result.error || !result.data) throw new VehicleSaleRecognitionError('DOCUMENT_UNAVAILABLE','Document is unavailable.',409);
          return new Uint8Array(await result.data.arrayBuffer());
        }});
      await db.query('release savepoint browser_request');savepoint=false;
      response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({success:true,result}));
    } catch(error:unknown) {
      if(savepoint){await db.query('rollback to savepoint browser_request');await db.query('release savepoint browser_request');}
      response.writeHead(error instanceof VehicleSaleRecognitionError ? error.httpStatus : 500,{'Content-Type':'application/json'});
      response.end(JSON.stringify({error:error instanceof Error ? error.message : 'Request failed'}));
    } finally { releaseRequest(); }
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address || typeof address==='string')throw Error('Browser proof listener failed.');
  let browser: Browser | undefined;
  try {
    if(process.argv.includes('--fail-browser-launch'))throw Error('INJECTED_BROWSER_LAUNCH_FAILURE');
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    const browserErrors:string[]=[];page.on('pageerror',error=>browserErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    const anonymous=await page.request.get(`http://127.0.0.1:${address.port}/api/bella-auto/sales-chain/state?bookingId=${bookingId}`);
    assert.equal(anonymous.status(),401);
    await page.evaluate(async credentials=>{
      const login=Reflect.get(globalThis,'automoveLogin');
      if(typeof login!=='function')throw Error('Browser login entry is missing');
      const result=await login(credentials.email,credentials.password);
      if(result.error)throw Error('Browser Auth login failed');
      const open=Reflect.get(globalThis,'automoveOpen');if(typeof open==='function')open();
    },{email,password});
    await page.getByLabel('Giá bán (VND)',{exact:true}).fill('1500000000');
    await page.getByLabel('Chiết khấu (VND)',{exact:true}).fill('100000000');
    await page.getByLabel('Giá vốn (VND)',{exact:true}).fill('1100000000');
    await page.getByLabel('Chứng từ bán xe',{exact:true}).setInputFiles({name:'sale.pdf',mimeType:'application/pdf',buffer:bytes});
    await page.getByLabel('Chứng từ giá vốn',{exact:true}).setInputFiles({name:'cost.pdf',mimeType:'application/pdf',buffer:bytes});
    await page.getByRole('button',{name:'Lưu hồ sơ nháp',exact:true}).click();
    await page.getByText('Đã lưu hồ sơ nháp.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Sửa hồ sơ nháp',exact:true}).click();
    await page.getByLabel('Giá vốn (VND)',{exact:true}).fill('1000000000');
    await page.getByRole('button',{name:'Lưu hồ sơ nháp',exact:true}).click();
    await page.getByText('Đã lưu hồ sơ nháp.',{exact:true}).waitFor();
    await page.getByRole('checkbox',{name:'Tôi đã kiểm tra chứng từ và xác nhận các giá trị tài chính.'}).check();
    const stateResponse = await page.request.get(`http://127.0.0.1:${address.port}/api/bella-auto/sales-chain/state?bookingId=${bookingId}`);
    const displayed = object(object(await stateResponse.json()).result).snapshot;
    const viewed = object(displayed);
    const update = {snapshotId:viewed.id,salePrice:1500000000,discountAmount:100000000,costBasis:1100000000,
      saleDocument:viewed.sale_document,costDocument:viewed.cost_document};
    const correctedResponse = await page.request.post(`http://127.0.0.1:${address.port}/api/bella-auto/sales-chain/draft-update`,{data:update});
    assert.equal(correctedResponse.status(),200);
    await page.getByRole('button',{name:'Xác nhận bàn giao',exact:true}).click();
    await page.getByText('Đã lưu bằng chứng bàn giao.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('checkbox',{name:'Tôi đã kiểm tra chứng từ và xác nhận các giá trị tài chính.'}).isChecked(),false,'Refreshing a corrected draft must invalidate prior human verification.');
    assert.equal(await page.getByRole('button',{name:'Duyệt snapshot',exact:true}).isDisabled(),true);
    const restoreResponse = await page.request.post(`http://127.0.0.1:${address.port}/api/bella-auto/sales-chain/draft-update`,{data:{...update,costBasis:1000000000}});
    assert.equal(restoreResponse.status(),200);
    await page.getByRole('button',{name:'Xác nhận lại bàn giao',exact:true}).click();
    await page.getByText('Đã lưu bằng chứng bàn giao.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('checkbox',{name:'Tôi đã kiểm tra chứng từ và xác nhận các giá trị tài chính.'}).isChecked(),false,'Restoring an old draft hash must not restore its old verification.');
    await page.getByRole('checkbox',{name:'Tôi đã kiểm tra chứng từ và xác nhận các giá trị tài chính.'}).check();
    await page.getByRole('button',{name:'Duyệt snapshot',exact:true}).click();
    await page.getByText('Đã duyệt snapshot tài chính.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Xác nhận lại bàn giao',exact:true}).click();
    await page.getByText('Đã lưu bằng chứng bàn giao.',{exact:true}).waitFor();
    assert.equal((await db.query('select count(*)::int as n from public.auto_vehicle_sale_recognitions where booking_id=$1',[bookingId])).rows[0].n,0);
    await page.getByRole('button',{name:'Ghi nhận doanh thu',exact:true}).click();
    await page.getByText('Đã ghi nhận doanh thu bán xe.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Ghi nhận doanh thu',exact:true}).click();
    await page.getByText('Đã ghi nhận doanh thu bán xe.',{exact:true}).waitFor();
    const ledgers=(await db.query('select * from public.auto_vehicle_sale_recognitions where booking_id=$1',[bookingId])).rows;
    assert.equal(ledgers.length,1);assert.equal(Number(ledgers[0].sale_price_recognized),1400000000);assert.equal(Number(ledgers[0].cost_basis_at_sale),1000000000);
    mkdirSync('.cache/automove-handover',{recursive:true});
    await page.screenshot({path:'.cache/automove-handover/desktop.png'});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),true,'Mobile content must fit the viewport.');
    await page.screenshot({path:'.cache/automove-handover/mobile.png'});
    assert.deepEqual(browserErrors,[]);
    console.log('AutoMove browser component + authenticated HTTP dispatcher + Real DB + private Storage E2E PASS (desktop/mobile).');
  } finally {
    try { if(browser)await browser.close(); }
    finally {
      server.closeAllConnections();
      await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    }
  }
}

async function main() {
  await db.connect();
  try {
    assert.equal((await db.query("select count(*)::int as n from supabase_migrations.schema_migrations where version = '20261014030000'")).rows[0].n,1,'Snapshot migration must be applied durably.');
    assert.equal((await db.query("select count(*)::int as n from supabase_migrations.schema_migrations where version = '20261014030100'")).rows[0].n,1,'Accountant-only forward migration must be applied durably.');
    assert.equal((await db.query("select count(*)::int as n from supabase_migrations.schema_migrations where version = '20261014030200'")).rows[0].n,1,'Draft-correction forward migration must be applied durably.');
    const policies = (await db.query(`select policyname, qual, with_check from pg_policies
      where policyname in ('automove_snapshot_read','automove_snapshot_draft',
        'automove_sale_document_read','automove_sale_document_upload')`)).rows;
    assert.equal(policies.length,4,'Snapshot and document policies must exist.');
    for (const policy of policies) {
      assert.match(String(policy.qual || policy.with_check),/accountant/);
      assert.doesNotMatch(String(policy.qual || '') + String(policy.with_check || ''),/finance_manager/);
    }
    const email = `automove-proof-${randomUUID()}@example.test`, password = randomBytes(32).toString('hex');
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('Cannot create temporary E2E Auth actor.');
    actorId = created.data.user.id;
    await db.query('begin isolation level serializable'); inBusinessTransaction = true;
    await db.query("insert into public.tenants (id,name,status) values ($1,'AutoMove sale proof A','active'),($2,'AutoMove sale proof B','active')",[tenantA,tenantB]);
    if(process.argv.includes('--fail-setup-transaction'))throw new Error('INJECTED_SETUP_TRANSACTION_FAILURE');
    await db.query(`insert into public.users (id,email,full_name,tenant_id,role,status)
      values ($1,$2,'AutoMove sale proof actor',$3,'accountant','active')
      on conflict (id) do update set tenant_id = excluded.tenant_id, role = excluded.role, status = excluded.status`,[actorId,email,tenantA]);
    await db.query('commit'); inBusinessTransaction = false; headerCreated = true;
    if(process.argv.includes('--fail-setup'))throw new Error('INJECTED_SETUP_FAILURE');
    const login = await authenticated.auth.signInWithPassword({ email,password });
    if (login.error || !login.data.user) throw new Error('Temporary E2E Auth login failed.');
    assert.equal((await authenticated.auth.getUser()).data.user?.id,actorId,'Auth identity must be real and verified.');
    for (const path of paths) {
      const upload = await authenticated.storage.from(bucket).upload(path,bytes,{ contentType:'application/pdf',upsert:false });
      if (upload.error) throw new Error(`E2E document upload failed (${upload.error.name}).`);
    }
    const outsideUpload = await authenticated.storage.from(bucket).upload(outsidePath,bytes,{contentType:'application/pdf'});
    assert.ok(outsideUpload.error,'Storage must reject uploads into another tenant folder.');
    await db.query('begin isolation level serializable'); inBusinessTransaction = true;
    await db.query("set local statement_timeout = '30s'");
    await db.query("insert into public.customers (id,tenant_id,phone,name_mother) values ($1,$2,$3,'Sale proof customer')",[customerId,tenantA,randomUUID().slice(0,12)]);
    await db.query("insert into public.auto_brands (id,tenant_id,name) values ($1,$2,'Sale proof brand')",[brandId,tenantA]);
    await db.query("insert into public.auto_models (id,tenant_id,brand_id,name) values ($1,$2,$3,'Sale proof model')",[modelId,tenantA,brandId]);
    await db.query("insert into public.auto_variants (id,tenant_id,model_id,name,year) values ($1,$2,$3,'Sale proof variant',2026)",[variantId,tenantA,modelId]);
    await db.query(`insert into public.auto_vehicles (id,tenant_id,variant_id,vin,color_exterior,model_year,list_price,cost_price,status)
      values ($1,$2,$3,$4,'White',2026,9900000000,8800000000,'showroom')`,[vehicleId,tenantA,variantId,randomUUID().replaceAll('-','').slice(0,17).toUpperCase()]);
    await context(actorId);
    await db.query(`insert into public.auto_bookings (id,tenant_id,customer_id,vehicle_id,variant_id,color_exterior,booking_number,total_price,deposit_amount,deposit_paid,payment_status,status)
      values ($1,$2,$3,$4,$5,'White',$6,7700000000,100000000,100000000,'fully_paid','confirmed')`,[bookingId,tenantA,customerId,vehicleId,variantId,`SALE-${randomUUID()}`]);
    await db.query(`insert into public.auto_deposits (tenant_id,booking_id,amount,payment_method,status,created_by,confirmed_by,confirmed_at)
      values ($1,$2,100000000,'bank_transfer','confirmed',$3,$3,now())`,[tenantA,bookingId,actorId]);
    const mobility = new MobilityFoundationService(new PostgresMobilityRepository(db,true),{
      ensureAllowed: async params => { assert.equal(params.actor.userId,actorId); assert.equal(params.tenantId,tenantA); },
    },{next:()=>randomUUID()},{now:()=>new Date().toISOString()});
    await mobility.transitionVehicleStatus({ userId:actorId,tenantId:tenantA,roles:['accountant'] },{
      vehicleId,toStatus:'allocated',idempotencyKey:`allocate:${bookingId}`,allocatedToContractId:bookingId,
    });
    await db.query('savepoint before_sales');
    console.log('Booking/deposit fixture and Mobility allocation persisted in rollback transaction.');
    const service = new AutoMoveSaleChainService(db,actorId,download);
    const draft = { bookingId,salePrice:1500000000,discountAmount:100000000,costBasis:1000000000,
      saleDocument:{bucket,path:paths[0],sha256:checksum},costDocument:{bucket,path:paths[1],sha256:checksum} };
    await rejected(()=>service.createSnapshot({...draft,status:'approved'}),/Only .* are accepted/);
    await rejected(()=>service.createSnapshot({...draft,costDocument:{...draft.costDocument,path:`${tenantB}/source.pdf`}}),/snapshot tenant folder/);
    await rejected(async()=>{
      const bad=await service.createSnapshot({...draft,costDocument:{...draft.costDocument,sha256:'0'.repeat(64)}});
      await service.approve({snapshotId:bad.id,documentsVerified:true,reviewHash:bad.reviewHash});
    },/checksum/);
    await rejected(async()=>{
      const missing=await service.createSnapshot({...draft,costDocument:{...draft.costDocument,path:`${tenantA}/missing.pdf`}});
      await service.approve({snapshotId:missing.id,documentsVerified:true,reviewHash:missing.reviewHash});
    },/DOCUMENT_UNAVAILABLE/);
    const snapshot = await executeSaleChainAction({action:'snapshot',payload:draft,actorUserId:actorId,db,download});
    const snapshotId = String(object(snapshot).id);
    const approvePayload = {snapshotId,documentsVerified:true,reviewHash:object(snapshot).reviewHash};
    console.log('Financial draft persisted; exercising approval denials.');
    assert.equal(object(snapshot).status,'draft');
    const retryDraft = await service.createSnapshot(draft);
    assert.equal(retryDraft.id,snapshotId,'Draft retry must preserve transaction and idempotency identity.');
    const correction = {snapshotId,salePrice:draft.salePrice,discountAmount:draft.discountAmount,costBasis:1100000000,
      saleDocument:draft.saleDocument,costDocument:draft.costDocument};
    const corrected = object(await executeSaleChainAction({action:'draft-update',payload:correction,actorUserId:actorId,db,download}));
    assert.equal(corrected.id,snapshotId);assert.equal(corrected.sale_transaction_id,object(snapshot).sale_transaction_id);
    assert.equal(corrected.idempotency_key,object(snapshot).idempotency_key);
    assert.equal(Number(corrected.cost_basis),1100000000);
    await rejected(()=>service.approve(approvePayload),/draft changed/);
    assert.equal(object(await service.updateDraft(correction)).id,snapshotId,'Draft correction retry must not create another row.');
    await rejected(()=>service.updateDraft({...correction,status:'approved'}),/Only .* are accepted/);
    const badCorrection = await service.updateDraft({...correction,costBasis:1000000000,costDocument:{...draft.costDocument,sha256:'0'.repeat(64)}});
    await rejected(()=>service.approve({...approvePayload,reviewHash:badCorrection.reviewHash}),/checksum/);
    await service.updateDraft({...correction,costBasis:1000000000});
    await rejected(()=>service.recognize({snapshotId,handoverEvidenceId:randomUUID()}),/approved financial snapshot/);
    await rejected(()=>db.query("update public.auto_vehicle_sale_financial_snapshots set status = 'approved',approved_by=$2,approved_at=now() where id=$1",[snapshotId,actorId]),/permission denied/);
    await rejected(()=>service.approve({...approvePayload,documentsVerified:false}),/explicitly verify/);
    for (const change of ["role = 'admin'","role = 'admin_staff'","status = 'inactive'","tenant_id = $2"]) {
      await db.query('savepoint actor_case'); await db.query('reset role');
      await db.query(`update public.users set ${change} where id = $1`,change.includes('$2') ? [actorId,tenantB] : [actorId]);
      await context(actorId);
      const inactive = change.includes('inactive');
      const rejection = inactive ? { code: '42501' } : change.includes('$2') ? /unavailable for this tenant/ : /active tenant accountant/;
      await rejected(()=>service.approve(approvePayload),rejection);
      await rejected(()=>service.updateDraft(correction),rejection);
      for (const read of [
        () => db.query('select id from public.auto_vehicle_sale_financial_snapshots where id=$1',[snapshotId]),
        () => db.query('select id from storage.objects where bucket_id=$1 and name=$2',[bucket,paths[0]]),
      ]) {
        if (inactive) await rejected(read,{code:'42501'});
        else assert.equal((await read()).rows.length,0,'RLS must deny snapshot and document reads.');
      }
      await db.query('set local role service_role');
      await rejected(()=>db.query("update public.auto_vehicle_sale_financial_snapshots set status='approved',approved_by=$2,approved_at=now() where id=$1",[snapshotId,actorId]),/active tenant accountant/);
      await db.query('rollback to savepoint actor_case'); await db.query('release savepoint actor_case');
    }
    await context(randomUUID());
    await rejected(()=>new AutoMoveSaleChainService(db,randomUUID(),download).approve(approvePayload),{code:'42501'});
    await context(actorId);
    const token = (await authenticated.auth.getSession()).data.session?.access_token;
    assert.ok(token,'A real user Bearer session is required.');
    const bearerClient = createSaleChainBearerClient(`Bearer ${token}`,apiUrl,publicKey || '');
    assert.equal((await bearerClient.auth.getUser(token)).data.user?.id,actorId);
    const bearerDownload: DocumentDownload = async document => {
      const result = await bearerClient.storage.from(document.bucket).download(document.path);
      if(result.error || !result.data)throw Error('BEARER_DOCUMENT_UNAVAILABLE');
      return new Uint8Array(await result.data.arrayBuffer());
    };
    const approved = await executeSaleChainAction({action:'approve',payload:approvePayload,actorUserId:actorId,db,download:bearerDownload});
    assert.equal(object(approved).approved_by,actorId); assert.ok(object(approved).approved_at);
    const approvalRetry = object(await executeSaleChainAction({action:'approve',payload:approvePayload,actorUserId:actorId,db,download}));
    assert.equal(approvalRetry.approved_by,object(approved).approved_by);
    assert.deepEqual(approvalRetry.approved_at,object(approved).approved_at,'Approval retry must preserve the original approval time.');
    console.log('Financial snapshot approved after real Storage checksum verification.');
    await rejected(()=>service.updateDraft(correction),/immutable/);
    await rejected(()=>service.recognize({snapshotId,handoverEvidenceId:randomUUID()}),/handover evidence/);
    await db.query('savepoint allocation_case');await db.query('reset role');
    await db.query('update public.auto_vehicles set allocated_to_contract_id=$2 where id=$1',[vehicleId,randomUUID()]);
    await context(actorId);
    await rejected(()=>service.handover({bookingId}),/not allocated to this booking/);
    await db.query('rollback to savepoint allocation_case');await context(actorId);
    const handover = object(await executeSaleChainAction({action:'handover',payload:{bookingId},actorUserId:actorId,db,download}));
    const handoverEvidenceId = String(handover.handoverEvidenceId);
    for (const metadata of [{bookingId:randomUUID(),customerId},{bookingId,customerId:randomUUID()}]) {
      await db.query('savepoint evidence_case');await db.query('reset role');
      const mismatchedId = randomUUID();
      await db.query(`insert into public.auto_vehicle_status_logs
        (id,tenant_id,vehicle_id,from_status,to_status,changed_by_user_id,reason,metadata)
        select $2,tenant_id,vehicle_id,from_status,to_status,changed_by_user_id,'Mismatch proof',$3::jsonb
        from public.auto_vehicle_status_logs where id=$1`,[handoverEvidenceId,mismatchedId,JSON.stringify(metadata)]);
      await context(actorId);
      await rejected(()=>service.recognize({snapshotId,handoverEvidenceId:mismatchedId}),/handover evidence/);
      assert.equal((await db.query('select count(*)::int as n from public.auto_vehicle_sale_recognitions where booking_id=$1',[bookingId])).rows[0].n,0);
      await db.query('rollback to savepoint evidence_case');await context(actorId);
    }
    for (const mismatch of ['vehicle_id','tenant_id']) {
      await db.query('savepoint evidence_scope_case');await db.query('reset role');
      const mismatchedId = randomUUID(), outsideVehicle = randomUUID();
      await db.query(`insert into public.auto_vehicles (id,tenant_id,variant_id,vin,color_exterior,model_year,list_price,cost_price,status)
        values ($1,$2,$3,$4,'White',2026,1,1,'showroom')`,[outsideVehicle,tenantA,variantId,randomUUID().replaceAll('-','').slice(0,17).toUpperCase()]);
      await db.query(`insert into public.auto_vehicle_status_logs
        (id,tenant_id,vehicle_id,from_status,to_status,changed_by_user_id,reason,metadata)
        select $2,$3,$4,from_status,to_status,changed_by_user_id,'Mismatch scope proof',metadata
        from public.auto_vehicle_status_logs where id=$1`,[handoverEvidenceId,mismatchedId,mismatch==='tenant_id'?tenantB:tenantA,mismatch==='vehicle_id'?outsideVehicle:vehicleId]);
      await context(actorId);
      await rejected(()=>service.recognize({snapshotId,handoverEvidenceId:mismatchedId}),/handover evidence/);
      await db.query('rollback to savepoint evidence_scope_case');await context(actorId);
    }
    assert.equal((await db.query('select count(*)::int as n from public.auto_vehicle_sale_recognitions where booking_id=$1',[bookingId])).rows[0].n,0,'Handover and approval must not auto-recognize.');
    assert.equal((await service.handover({bookingId})).handoverEvidenceId,handoverEvidenceId,'Handover retry must return the persisted evidence.');
    await rejected(()=>service.recognize({snapshotId,handoverEvidenceId,salePriceRecognized:1}),/Only .* are accepted/);
    await db.query('savepoint refund_before_recognition');
    const originalDeposit = (await db.query('select id from public.auto_deposits where booking_id=$1 and tenant_id=$2',[bookingId,tenantA])).rows[0];
    const refundKey = randomUUID();
    await new AutoMoveSettlementService(db,actorId,download).execute(bookingId,refundKey,{
      action:'refund',receiptType:'deposit',receiptId:originalDeposit.id,amount:20000000,
      reason:'Owner-confirmed receipt refund before explicit recognition',document:draft.saleDocument,confirmed:true,
    });
    const netRecognition = await service.recognize({snapshotId,handoverEvidenceId});
    assert.equal(netRecognition.recognition.depositReceivedTotal,80000000);
    assert.equal(netRecognition.recognition.paymentReceivedTotal,80000000);
    assert.equal(netRecognition.recognition.receivableAmountAtRecognition,1320000000);
    assert.equal(netRecognition.recognition.salePriceRecognized,1400000000);
    await db.query('rollback to savepoint refund_before_recognition');
    console.log('AUTOMOVE_PRE_RECOGNITION_REFUND_NET_CASH_AND_IMMUTABLE_PRICE=PASS_ROLLBACK');
    const recognized = object(await executeSaleChainAction({action:'recognize',payload:{snapshotId,handoverEvidenceId},actorUserId:actorId,db,download}));
    assert.equal(recognized.status,'created');
    const retry = await service.recognize({snapshotId,handoverEvidenceId});
    assert.equal(retry.status,'idempotent'); assert.equal(retry.recognition.id,object(recognized.recognition).id);
    await db.query('savepoint mutable_retry_case');await db.query('reset role');
    await db.query("update public.auto_deposits set amount=9900000000 where booking_id=$1",[bookingId]);
    await db.query("update public.policy_registry set expire_date='2020-01-01' where policy_id='AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY'");
    await db.query("update public.auto_bookings set status='cancelled',payment_status='refunded' where id=$1",[bookingId]);
    await db.query("update public.auto_vehicles set status='returned' where id=$1",[vehicleId]);
    await context(actorId);
    const historicalRetry = await service.recognize({snapshotId,handoverEvidenceId});
    assert.equal(historicalRetry.status,'idempotent');assert.equal(historicalRetry.recognition.id,object(recognized.recognition).id);
    assert.equal(historicalRetry.recognition.paymentReceivedTotal,100000000);
    await db.query('rollback to savepoint mutable_retry_case');await context(actorId);
    const rows = (await db.query('select * from public.auto_vehicle_sale_recognitions where booking_id = $1',[bookingId])).rows;
    assert.equal(rows.length,1); assert.equal(Number(rows[0].sale_price_recognized),1400000000);
    assert.equal(Number(rows[0].cost_basis_at_sale),1000000000); assert.equal(Number(rows[0].payment_received_total),100000000);
    assert.equal(Number(rows[0].receivable_amount_at_recognition),1300000000); assert.equal(rows[0].booking_id,bookingId);
    assert.equal(rows[0].vehicle_id,vehicleId); assert.equal(rows[0].customer_id,customerId);
    assert.equal(rows[0].accounting_policy_id,'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY'); assert.ok(rows[0].accounting_policy_version);
    assert.equal(rows[0].metadata.handoverEvidenceId,handoverEvidenceId); assert.equal(rows[0].metadata.snapshotId,snapshotId);
    await db.query('set local role service_role');
    await rejected(()=>db.query('update public.auto_vehicle_sale_financial_snapshots set cost_basis=1 where id=$1',[snapshotId]),/immutable/);
    await db.query('reset role');
    await db.query('update public.auto_vehicles set cost_price=1 where id=$1',[vehicleId]);
    assert.equal(Number((await db.query('select cost_basis_at_sale from public.auto_vehicle_sale_recognitions where booking_id=$1',[bookingId])).rows[0].cost_basis_at_sale),1000000000);
    await db.query('savepoint tenant_case');
    await db.query('update public.users set tenant_id=$2 where id=$1',[actorId,tenantB]); await context(actorId);
    assert.equal((await db.query('select id from public.auto_vehicle_sale_financial_snapshots where id=$1',[snapshotId])).rows.length,0);
    await rejected(()=>service.recognize({snapshotId,handoverEvidenceId}),/unavailable for this tenant/);
    await db.query('rollback to savepoint tenant_case');
    if(process.argv.includes('--browser')) {
      await db.query('rollback to savepoint before_sales');
      await browserProof(email,password);
    }
    await db.query('rollback'); inBusinessTransaction = false;
    console.log('AutoMove handover/approved-snapshot/explicit-recognition Real DB verification PASS (business transaction rolled back).');
    console.log('Real Supabase Auth and private Storage document verification PASS.');
  } catch (error: unknown) {
    primaryFailure = error; throw error;
  } finally {
    const cleanupErrors: unknown[] = [];
    const attempt = async (cleanup: () => Promise<unknown>) => {
      try { await cleanup(); } catch (error: unknown) { cleanupErrors.push(error); }
    };
    if (inBusinessTransaction && !connectionFailure) await attempt(()=>db.query('rollback'));
    // Reconnect only for fixture cleanup, never to replay a business mutation.
    const cleanupDb = connectionFailure ? new Client(saleChainConnection(dbUrl,apiUrl)) : db;
    if (cleanupDb !== db) await attempt(()=>cleanupDb.connect());
    await attempt(()=>cleanupDb.query('reset role'));
    if(process.argv.includes('--fail-cleanup'))await attempt(async()=>{throw new Error('INJECTED_CLEANUP_FAILURE');});
    const fixturePaths = new Set(cleanupPaths);
    for (const tenant of [tenantA,tenantB]) await attempt(async()=>{
      const files = await admin.storage.from(bucket).list(tenant);
      if(files.error)throw new Error('E2E Storage fixture listing failed.');
      for (const file of files.data || []) if(file.id)fixturePaths.add(`${tenant}/${file.name}`);
    });
    await attempt(async()=>{
      const removal = await admin.storage.from(bucket).remove([...fixturePaths]);
      if (removal.error) throw new Error('E2E Storage cleanup failed.');
    });
    if (actorId) await attempt(()=>cleanupDb.query('delete from public.users where id=$1',[actorId]));
    // Preserve the pre-existing tenant timeline/soft-delete contract.
    if (headerCreated) await attempt(()=>cleanupDb.query("update public.tenants set status='terminated' where id=any($1::uuid[])",[[tenantA,tenantB]]));
    const cleanupActor = actorId;
    if (cleanupActor) await attempt(async()=>{
      const authRemoval = await admin.auth.admin.deleteUser(cleanupActor);
      if (authRemoval.error) throw new Error('E2E Auth cleanup failed.');
    });
    await attempt(()=>db.end());
    if (cleanupDb !== db) await attempt(()=>cleanupDb.end());
    if (cleanupErrors.length) throw new AggregateError([...(primaryFailure?[primaryFailure]:[]),...cleanupErrors],'Verification/fixture cleanup failed.');
  }
}
main().catch((error: unknown) => {
  if (error instanceof AggregateError) {
    for (const cause of error.errors) console.error(cause instanceof Error ? cause.message : 'Verification error');
  }
  console.error(error instanceof Error ? error.message : 'AutoMove verification failed.');
  process.exitCode = 1;
});
