'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {project,must,connect}=require('./local-runtime.cjs');
connect().then(async({db})=>{
  try{
    must(Number((await db.query('select count(*)::int as count from public.users')).rows[0].count)===0,'EXPECTED_EMPTY_LOCAL_USER_FIXTURE');
    const id=crypto.randomUUID();
    const inserted=await db.query("insert into public.users(id,email,full_name,role,status,tenant_id) values($1,$2,'Synthetic local lab actor','admin','active','00000000-0000-0000-0000-000000000001')",[id,`synthetic-${id}@example.invalid`]);
    must(inserted.rowCount===1,'VALID_ACTOR_FIXTURE_NOT_PROVEN');
    fs.writeFileSync(path.join(__dirname,'local-lab-actor.json'),JSON.stringify({capturedAt:new Date().toISOString(),project,result:'PASS_VALID_LOCAL_ACTOR_FIXTURE',actorId:id,role:'admin',insertedRows:1,syntheticOnly:true,authProviderUser:false,authorizationProof:false,note:'Lab suite explicitly selects an existing public user. Its fallback practitioner role is outside canonical users_role_check; no constraint or role mapping is widened.'},null,2)+'\n');
    console.log(JSON.stringify({result:'PASS_VALID_LOCAL_ACTOR_FIXTURE',insertedRows:1,authorizationProof:false}));
  }finally{await db.end();}
}).catch(error=>{console.error(JSON.stringify({result:'LOCAL_ACTOR_FIXTURE_FAILED',code:/^[A-Z0-9_]+$/.test(error.message)?error.message:'SANITIZED_FAILURE'}));process.exitCode=1;});
