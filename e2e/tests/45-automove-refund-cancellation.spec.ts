import { test, expect, type Page } from '@playwright/test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { saleChainConnection } from '../../src/modules/bella-auto/services/AutoMoveSaleChainConnection';

test.use({ trace:'off',video:'off' });
// Customer/catalog/booking/recognition/receipt setup is privileged fixture data,
// not proof of their creation. Refunds/cancellations use real Next.js UI/API/Auth.
async function fixture(page: Page, baseURL: string | undefined, recognized: boolean) {
  const api=process.env.NEXT_PUBLIC_SUPABASE_URL || '',url=process.env.DB_URL || process.env.SUPABASE_DB_URL || '';
  expect(new URL(api).hostname).toBe('bmnbqbcdbuklhopfbopv.supabase.co');
  expect(baseURL && ['localhost','127.0.0.1'].includes(new URL(baseURL).hostname)).toBe(true);
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key || !url)throw Error('Non-Production fixture credentials required');
  const admin=createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const db=new Client(saleChainConnection(url,api));
  const tenant=randomUUID(),otherTenant=randomUUID(),customer=randomUUID(),brand=randomUUID(),model=randomUUID(),variant=randomUUID();
  const booking=randomUUID(),vehicle=randomUUID(),deposit=randomUUID(),recognition=randomUUID(),payment=randomUUID();
  const email=`automove-settlement-${randomUUID()}@example.test`,password=randomBytes(32).toString('hex');
  const number=`REFUND-${randomUUID().slice(0,8)}`;
  let actor:string|undefined,seeded=false,connected=false;
  const cleanup=async()=>{
    const failures:unknown[]=[];
    const attempt=async(fn:()=>Promise<unknown>)=>{try{await fn();}catch(error:unknown){failures.push(error);}};
    await attempt(()=>page.unrouteAll({behavior:'wait'}));
    if(seeded){
      await attempt(async()=>{
        const files=await admin.storage.from('automove-sale-documents').list(tenant);
        if(files.error)throw Error('Document listing failed');
        if(files.data.length && (await admin.storage.from('automove-sale-documents').remove(files.data.map(file=>`${tenant}/${file.name}`))).error)throw Error('Document cleanup failed');
      });
      await attempt(async()=>{
        const cleanupDb=new Client(saleChainConnection(url,api));
        try{await cleanupDb.connect();await cleanupDb.query('begin');
          await cleanupDb.query("update public.users set status='inactive' where id=$1 and tenant_id=$2",[actor,tenant]);
          await cleanupDb.query("update public.tenants set status='terminated' where id=any($1::uuid[])",[[tenant,otherTenant]]);
          await cleanupDb.query('commit');
        }catch(error:unknown){await cleanupDb.query('rollback').catch(()=>undefined);throw error;}finally{await cleanupDb.end();}
      });
    }
    const cleanupActor=actor;
    if(cleanupActor)await attempt(async()=>{if((await admin.auth.admin.deleteUser(cleanupActor)).error)throw Error('Auth cleanup failed');});
    if(seeded)await attempt(async()=>{
      expect((await db.query('select id from auth.users where id=$1',[actor])).rows).toHaveLength(0);
      expect((await db.query("select id from public.users where id=$1 and status='active'",[actor])).rows).toHaveLength(0);
      expect((await db.query("select id from public.tenants where id=any($1::uuid[]) and status<>'terminated'",[[tenant,otherTenant]])).rows).toHaveLength(0);
      const files=await admin.storage.from('automove-sale-documents').list(tenant);if(files.error)throw Error('Storage read-back failed');expect(files.data).toHaveLength(0);
      console.log('AUTOMOVE_SETTLEMENT_CLEANUP=AUTH_ZERO_ACTIVE_ZERO_STORAGE_ZERO_HISTORY_RETAINED');
    });
    if(connected)await attempt(()=>db.end());
    if(failures.length)throw new AggregateError(failures,'Settlement fixture cleanup failed');
  };
  try{
    await db.connect();connected=true;db.on('error',()=>undefined);
    const auth=await admin.auth.admin.createUser({email,password,email_confirm:true});
    if(auth.error || !auth.data.user)throw Error('Temporary E2E actor creation failed');actor=auth.data.user.id;
    await db.query('begin');
    for(const id of [tenant,otherTenant])await db.query(`insert into public.tenants(id,name,status,enabled_modules)
      values($1,'AutoMove refund browser fixture','active','{"bella_auto":true}')`,[id]);
    await db.query("insert into public.users(id,email,full_name,tenant_id,role,status) values($1,$2,'Refund browser accountant',$3,'accountant','active') on conflict(id) do update set tenant_id=excluded.tenant_id,role=excluded.role,status=excluded.status",[actor,email,tenant]);
    await db.query("insert into public.customers(id,tenant_id,name_mother,phone) values($1,$2,'Refund browser customer',$3)",[customer,tenant,randomUUID()]);
    await db.query("insert into public.auto_brands(id,tenant_id,name) values($1,$2,'Refund brand')",[brand,tenant]);
    await db.query("insert into public.auto_models(id,tenant_id,brand_id,name) values($1,$2,$3,'Refund model')",[model,tenant,brand]);
    await db.query("insert into public.auto_variants(id,tenant_id,model_id,name,year) values($1,$2,$3,'Refund variant',2026)",[variant,tenant,model]);
    await db.query(`insert into public.auto_vehicles(id,tenant_id,variant_id,vin,color_exterior,model_year,status)
      values($1,$2,$3,$4,'White',2026,$5)`,[vehicle,tenant,variant,randomUUID().replaceAll('-','').slice(0,17),recognized?'delivered':'allocated']);
    await db.query(`insert into public.auto_bookings(id,tenant_id,customer_id,vehicle_id,variant_id,color_exterior,booking_number,total_price,deposit_amount,deposit_paid,status)
      values($1,$2,$3,$4,$5,'White',$6,1400000000,100000000,100000000,$7)`,[booking,tenant,customer,vehicle,variant,number,recognized?'completed':'confirmed']);
    await db.query('update public.auto_vehicles set allocated_to_contract_id=$2 where id=$1',[vehicle,booking]);
    await db.query(`insert into public.auto_deposits(id,tenant_id,booking_id,amount,status,created_by,confirmed_by,confirmed_at)
      values($1,$2,$3,100000000,'confirmed',$4,$4,now())`,[deposit,tenant,booking,actor]);
    if(recognized){
      await db.query(`insert into public.auto_vehicle_sale_recognitions
        (id,tenant_id,sale_transaction_id,idempotency_key,booking_id,vehicle_id,customer_id,recognized_by_user_id,
         recognition_basis,source_document_type,source_document_id,accounting_policy_id,accounting_policy_version,
         sale_price_recognized,cost_basis_at_sale,cost_basis_source_type,cost_basis_source_ref,payment_received_total,deposit_received_total,receivable_amount_at_recognition)
        values($1,$2,$3,$4,$5,$6,$7,$8,'Declared recognized fixture','approved_financial_snapshot',$9,
        'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY','1.0.0',1400000000,1000000000,'approved_financial_snapshot',$9,100000000,100000000,1300000000)`,
      [recognition,tenant,randomUUID(),randomUUID(),booking,vehicle,customer,actor,randomUUID()]);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
      await db.query(`insert into public.auto_vehicle_sale_payments(id,tenant_id,booking_id,recognition_id,idempotency_key,amount,payment_method,received_by)
        values($1,$2,$3,$4,$5,1300000000,'cash',$6)`,[payment,tenant,booking,recognition,randomUUID(),actor]);
    }
    await db.query('commit');seeded=true;
    await page.goto('/login');await page.getByPlaceholder('email',{exact:true}).fill(email);await page.locator('input[type=password]').fill(password);
    const login=page.waitForResponse(response=>response.url().startsWith(`${api}/auth/v1/token`)&&response.request().method()==='POST');
    await page.getByRole('button',{name:'Đăng nhập ngay',exact:true}).click();expect((await login).status()).toBe(200);
    await page.waitForURL('**/dashboard/bella-auto',{timeout:60_000});
    await page.goto('/dashboard/bella-auto/bookings');
    await page.getByRole('button',{name:'Thanh toán sau bán',exact:true}).click();
    const row=page.getByRole('row').filter({hasText:number});
    await row.getByRole('button',{name:`Hồ sơ bán xe ${number}`,exact:true}).click();
    const panel=page.getByRole('region',{name:'Hoàn tiền và hủy giao dịch',exact:true});
    await expect(panel.getByTestId('refund-net')).toHaveText(recognized?'1.400.000.000 VND':'100.000.000 VND',{timeout:60_000});
    return {db,tenant,otherTenant,actor,booking,vehicle,payment,deposit,recognition,number,panel,cleanup};
  }catch(error:unknown){await db.query('rollback').catch(()=>undefined);await cleanup();throw error;}
}
const proof=Buffer.from('%PDF-1.4\nOwner confirmed manual cash refund or cancellation\n%%EOF');
async function documentAndConfirmation(panel: ReturnType<Page['getByRole']>, reason: string) {
  await panel.getByLabel('Lý do hoàn/hủy',{exact:true}).fill(reason);
  await panel.getByLabel('Chứng từ xác nhận hoàn/hủy',{exact:true}).setInputFiles({name:'confirmation.pdf',mimeType:'application/pdf',buffer:proof});
  await expect(panel.getByText('Đã tải chứng từ hoàn/hủy',{exact:true})).toBeVisible();
  await panel.getByRole('checkbox').check();
}

test('recognized sale: manual refund, lost acknowledgement, concurrency, cancellation and read-back',async({page,baseURL},testInfo)=>{
  test.setTimeout(420_000);
  const f=await fixture(page,baseURL,true),url=`/api/bella-auto/bookings/${f.booking}/settlement`;
  try{
    const original=(await f.db.query('select * from public.auto_vehicle_sale_recognitions where id=$1',[f.recognition])).rows;
    const originalReceipts=(await f.db.query('select * from public.auto_vehicle_sale_payments where booking_id=$1',[f.booking])).rows;
    await f.panel.getByLabel('Receipt gốc',{exact:true}).selectOption(`post_sale:${f.payment}`);
    await f.panel.getByLabel('Số tiền hoàn (VND)',{exact:true}).fill('50000000');
    await documentAndConfirmation(f.panel,'Confirmed partial refund');
    let saved:{key:string;data:Record<string,unknown>}|undefined,forwarded=0;
    await page.route(`**${url}`,async route=>{
      if(route.request().method()!=='POST'||saved){await route.continue();return;}
      saved={key:route.request().headers()['idempotency-key'],data:route.request().postDataJSON()};
      try{forwarded=(await route.fetch({timeout:60_000})).status();}catch{forwarded=-1;}finally{await route.abort('failed').catch(()=>undefined);}
    });
    await f.panel.getByRole('button',{name:'Xác nhận hoàn tiền',exact:true}).click();
    await expect(f.panel.getByRole('alert')).toBeVisible({timeout:60_000});expect(forwarded).toBe(200);
    expect((await f.db.query('select count(*)::int n from public.auto_vehicle_sale_settlement_actions where booking_id=$1',[f.booking])).rows[0].n).toBe(1);
    await page.unroute(`**${url}`);
    const acknowledgement=page.waitForResponse(response=>response.url().endsWith(url)&&response.request().method()==='POST',{timeout:60_000});
    await f.panel.getByRole('button',{name:'Thử lại cùng yêu cầu hoàn/hủy',exact:true}).click();
    const acknowledged=await acknowledgement;expect(acknowledged.status()).toBe(200);
    expect(await acknowledged.json()).toMatchObject({result:{duplicate:true,state:{refunded:50000000}}});
    if(!saved)throw Error('Original refund request must be observed');
    expect(acknowledged.request().headers()['idempotency-key']).toBe(saved.key);
    const post=(key:string,data:Record<string,unknown>)=>page.context().request.post(url,{headers:{'Idempotency-Key':key},data,timeout:60_000});
    const reliable=async(key:string,data:Record<string,unknown>)=>{
      for(let i=0;i<3;i++){const response=await post(key,data);if(response.status()!==409)return response;
        expect((await response.json()).code).toBe('SETTLEMENT_RETRY_REQUIRED');}
      throw Error('Concurrent request did not resolve with its original key');
    };
    const concurrentKey=randomUUID(),intent=saved.data;
    const same=await Promise.all([reliable(concurrentKey,{...intent,amount:10000000}),reliable(concurrentKey,{...intent,amount:10000000})]);
    expect(same.map(response=>response.status())).toEqual([200,200]);
    expect((await Promise.all(same.map(response=>response.json()))).map(body=>body.result.duplicate).sort()).toEqual([false,true]);
    const independent=await Promise.all([reliable(randomUUID(),{...intent,amount:20000000}),reliable(randomUUID(),{...intent,amount:20000000})]);
    expect(independent.map(response=>response.status())).toEqual([200,200]);
    expect((await post(randomUUID(),{...intent,amount:1200000001})).status()).toBe(400);
    expect((await post(saved.key,{...intent,amount:1})).status()).toBe(409);
    expect((await post(randomUUID(),{...intent,document:{...intent.document as object,sha256:createHash('sha256').update('wrong').digest('hex')}})).status()).toBe(409);
    for(const [tenant,status,role,expected] of [[f.otherTenant,'active','accountant',404],[f.tenant,'inactive','accountant',403],[f.tenant,'active','admin',403]] as const){
      try{await f.db.query('update public.users set tenant_id=$2,status=$3,role=$4 where id=$1',[f.actor,tenant,status,role]);
        expect((await post(randomUUID(),intent)).status()).toBe(expected);
      }finally{await f.db.query("update public.users set tenant_id=$2,status='active',role='accountant' where id=$1",[f.actor,f.tenant]);}
    }
    await f.panel.getByRole('button',{name:'Tải lại hoàn/hủy',exact:true}).click();
    await expect(f.panel.getByTestId('refund-total')).toHaveText('100.000.000 VND',{timeout:30_000});
    await f.panel.getByRole('radio',{name:'Hủy giao dịch',exact:true}).check();
    await documentAndConfirmation(f.panel,'Documented cancellation after handover');
    await f.panel.getByRole('button',{name:'Xác nhận hủy giao dịch',exact:true}).click();
    await expect(f.panel.getByTestId('refund-booking-status')).toHaveText('cancelled',{timeout:60_000});
    const reconciled=await page.context().request.get(`/api/bella-auto/bookings/${f.booking}/sale-payments`);
    expect(reconciled.status()).toBe(200);expect(await reconciled.json()).toMatchObject({result:{status:'MATCHED',saleAmount:1400000000,refundedTotal:100000000,totalReceived:1300000000,outstanding:100000000,canCollect:false}});
    expect((await f.db.query('select status from public.auto_vehicles where id=$1',[f.vehicle])).rows[0].status).toBe('delivered');
    expect((await f.db.query('select * from public.auto_vehicle_sale_recognitions where id=$1',[f.recognition])).rows).toEqual(original);
    expect((await f.db.query('select * from public.auto_vehicle_sale_payments where booking_id=$1',[f.booking])).rows).toEqual(originalReceipts);
    expect((await f.db.query('select id from public.auto_vehicle_sale_recognition_adjustments where recognition_id=$1',[f.recognition])).rows).toHaveLength(0);
    expect((await post(saved.key,intent)).status()).toBe(200);
    await page.reload();await page.getByRole('button',{name:'Lịch sử hủy',exact:true}).click();
    await page.getByRole('row').filter({hasText:f.number}).getByRole('button',{name:`Hồ sơ bán xe ${f.number}`,exact:true}).click();
    await expect(f.panel.getByTestId('refund-total')).toHaveText('100.000.000 VND',{timeout:60_000});
    await expect(f.panel.getByRole('list',{name:'Lịch sử hoàn/hủy'}).getByRole('listitem')).toHaveCount(5);
    await f.panel.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('settlement-desktop.png')});
    await page.setViewportSize({width:390,height:844});await f.panel.getByTestId('refund-net').scrollIntoViewIfNeeded();
    const dialog=page.getByRole('dialog');
    expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
    const bounds=await dialog.boundingBox();if(!bounds)throw Error('Dialog must have mobile bounds');
    for(const control of await f.panel.locator('select,input,button').all()){
      const box=await control.boundingBox();if(box){expect(box.x).toBeGreaterThanOrEqual(bounds.x);expect(box.x+box.width).toBeLessThanOrEqual(bounds.x+bounds.width);}
    }
    await page.screenshot({path:testInfo.outputPath('settlement-mobile.png')});
    console.log('AUTOMOVE_SETTLEMENT_REAL_BROWSER_REFUND_RETRY_CONCURRENCY_CANCEL_RELOAD=PASS');
  }finally{await f.cleanup();}
});

test('before recognition: deposit refund and cancellation release allocation without revenue',async({page,baseURL})=>{
  test.setTimeout(240_000);const f=await fixture(page,baseURL,false);
  try{
    await f.panel.getByLabel('Số tiền hoàn (VND)',{exact:true}).fill('20000000');
    await documentAndConfirmation(f.panel,'Confirmed deposit refund before revenue');
    await f.panel.getByRole('button',{name:'Xác nhận hoàn tiền',exact:true}).click();
    await expect(f.panel.getByTestId('refund-net')).toHaveText('80.000.000 VND',{timeout:60_000});
    await f.panel.getByRole('radio',{name:'Hủy giao dịch',exact:true}).check();
    await documentAndConfirmation(f.panel,'Confirmed cancellation before handover');
    await f.panel.getByRole('button',{name:'Xác nhận hủy giao dịch',exact:true}).click();
    await expect(f.panel.getByTestId('refund-booking-status')).toHaveText('cancelled',{timeout:60_000});
    expect((await f.db.query('select status,allocated_to_contract_id from public.auto_vehicles where id=$1',[f.vehicle])).rows[0]).toMatchObject({status:'showroom',allocated_to_contract_id:null});
    expect((await f.db.query('select id from public.auto_vehicle_sale_recognitions where booking_id=$1',[f.booking])).rows).toHaveLength(0);
    expect((await f.db.query('select amount,status from public.auto_deposits where id=$1',[f.deposit])).rows[0]).toEqual({amount:'100000000',status:'confirmed'});
    console.log('AUTOMOVE_PRE_HANDOVER_REFUND_CANCEL_ALLOCATION_REAL_BROWSER=PASS');
  }finally{await f.cleanup();}
});
