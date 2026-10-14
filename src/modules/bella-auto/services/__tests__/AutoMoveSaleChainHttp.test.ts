import { saleChainHttp } from '../AutoMoveSaleChainHttp';
import { POST } from '@/app/api/bella-auto/vehicle-sale-recognitions/route';
import { createHash } from 'node:crypto';

jest.mock('@/lib/supabase-server',()=>({createClient:()=>mockCreateClient()}));
jest.mock('pg',()=>({Client:jest.fn().mockImplementation(()=>mockPgClient())}));
jest.mock('@supabase/supabase-js',()=>({createClient:(...args:unknown[])=>mockUserClient(...args)}));
const mockUserClient=jest.fn();
const mockCreateClient=jest.fn();
const mockPgClient=jest.fn();

const actorId='e5890a31-cbfa-4f3a-9c30-f33d93614007';
const tenantId='dd8a52ba-50f6-43b4-88ef-4fef4842fafe';
const snapshotId='76a3b00b-d703-422a-bcda-00ce2faf6d35';
const handoverEvidenceId='84461be9-8c09-49f0-b90e-5ea0395f686d';
const bookingId='d2d38278-e320-4ed6-b0a5-4c0e67945c94';
const query=jest.fn();
const db={connect:jest.fn(),query,end:jest.fn()};
const getUser=jest.fn();
const previousEnv={DB_URL:process.env.DB_URL,NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY};
function request(body: unknown,authorization?:string) {return new Request('http://localhost/api/bella-auto/vehicle-sale-recognitions',{
  method:'POST',headers:{'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})},body:JSON.stringify(body),
});}
beforeEach(()=>{
  jest.clearAllMocks();
  process.env.DB_URL='postgresql://postgres.bmnbqbcdbuklhopfbopv@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://bmnbqbcdbuklhopfbopv.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='test-public-key';
  mockCreateClient.mockResolvedValue({auth:{getUser}});
  mockPgClient.mockReturnValue(db);
  getUser.mockResolvedValue({data:{user:{id:actorId}},error:null});
  query.mockImplementation(async(sql:string)=>sql.startsWith('select id, tenant_id, role, status from public.users')
    ? {rows:[{id:actorId,tenant_id:tenantId,role:'accountant',status:'active'}]} : {rows:[]});
});
afterAll(()=>{
  if(previousEnv.DB_URL===undefined)delete process.env.DB_URL;else process.env.DB_URL=previousEnv.DB_URL;
  if(previousEnv.NEXT_PUBLIC_SUPABASE_URL===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previousEnv.NEXT_PUBLIC_SUPABASE_URL;
  if(previousEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=previousEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
});
it('rejects draft status/identity injection through the dedicated update API',async()=>{
  expect((await saleChainHttp(request({snapshotId,status:'approved'}),'draft-update')).status).toBe(400);
  expect(query).not.toHaveBeenCalledWith(expect.stringContaining('update public.auto_vehicle_sale_financial_snapshots'),expect.anything());
});
it('uses the Bearer-authenticated client for Storage, without cookie or admin fallback',async()=>{
  const bytes=Buffer.from('approved evidence');
  const document={bucket:'automove-sale-documents',path:`${tenantId}/source.pdf`,sha256:createHash('sha256').update(bytes).digest('hex')};
  const snapshotRow={id:snapshotId,tenant_id:tenantId,booking_id:bookingId,vehicle_id:snapshotId,customer_id:actorId,status:'draft',sale_price:100,discount_amount:0,cost_basis:50,sale_document:document,cost_document:document};
  const reviewHash=createHash('sha256').update(JSON.stringify({id:snapshotId,tenantId,bookingId,vehicleId:snapshotId,customerId:actorId,salePrice:100,discountAmount:0,costBasis:50,saleDocument:document,costDocument:document})).digest('hex');
  const download=jest.fn().mockResolvedValue({data:new Blob([bytes]),error:null});
  const storageFrom=jest.fn().mockReturnValue({download});
  mockUserClient.mockReturnValue({auth:{getUser},storage:{from:storageFrom}});
  query.mockImplementation(async(sql:string)=>{
    if(sql.startsWith('select id, tenant_id, role, status'))return {rows:[{id:actorId,tenant_id:tenantId,role:'accountant',status:'active'}]};
    if(sql.includes('select * from public.auto_vehicle_sale_financial_snapshots'))return {rows:[snapshotRow]};
    if(sql.includes('select * from public.auto_bookings'))return {rows:[{id:bookingId,vehicle_id:snapshotId,customer_id:actorId,status:'confirmed'}]};
    if(sql.includes('select id from public.customers'))return {rows:[{id:actorId}]};
    if(sql.includes('update public.auto_vehicle_sale_financial_snapshots'))return {rows:[{...snapshotRow,status:'approved'}]};
    return {rows:[]};
  });
  expect((await saleChainHttp(request({snapshotId,documentsVerified:true,reviewHash},'Bearer user-session'),'approve')).status).toBe(200);
  expect(getUser).toHaveBeenCalledWith('user-session');
  expect(mockUserClient).toHaveBeenCalledWith(process.env.NEXT_PUBLIC_SUPABASE_URL,'test-public-key',expect.objectContaining({global:{headers:{Authorization:'Bearer user-session'}}}));
  expect(download).toHaveBeenCalledTimes(2);
});
it('rejects unauthenticated requests before opening a database connection',async()=>{
  getUser.mockResolvedValue({data:{user:null},error:null});
  expect((await POST(request({snapshotId,handoverEvidenceId}))).status).toBe(401);
  expect(db.connect).not.toHaveBeenCalled();
});
it('rejects caller financial/policy values at the recognition API boundary',async()=>{
  const response=await POST(request({snapshotId,handoverEvidenceId,salePriceRecognized:1,accountingPolicyVersion:'fake'}));
  expect(response.status).toBe(400);expect(query).not.toHaveBeenCalledWith(expect.stringContaining('insert into public.auto_vehicle_sale_recognitions'),expect.anything());
});
it('rejects inactive and non-accounting actors from the trusted profile source',async()=>{
  for(const actor of [
    {role:'admin',status:'active'},
    {role:'finance_manager',status:'active'},
    {role:'accountant',status:'inactive'},
    {role:'accountant',status:'active',tenant_id:null},
  ]) {
    query.mockImplementation(async(sql:string)=>sql.startsWith('select id, tenant_id, role, status from public.users')
      ? {rows:[{id:actorId,tenant_id:tenantId,...actor}]} : {rows:[]});
    expect((await saleChainHttp(request({snapshotId,documentsVerified:true}),'approve')).status).toBe(403);
  }
});
it('fails closed if the configured SQL database differs from the Auth project',async()=>{
  process.env.DB_URL='postgresql://postgres.different-project@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
  expect((await POST(request({snapshotId,handoverEvidenceId}))).status).toBe(503);
  expect(db.connect).not.toHaveBeenCalled();
});
it('accepts only the two IDs and loads the snapshot from the server',async()=>{
  const response=await POST(request({snapshotId,handoverEvidenceId}));
  expect(response.status).toBe(404);
  expect(query).toHaveBeenCalledWith(expect.stringContaining('from public.auto_vehicle_sale_financial_snapshots'),[snapshotId,tenantId]);
});
