const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const crypto = require("node:crypto");
const ts = require("typescript");
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"), { compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true } }).outputText,filename);
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request,parent,...rest) {
  const target = request.startsWith("@/") ? path.resolve(__dirname,"../src",request.slice(2)) : request.startsWith(".") && parent?.filename.endsWith(".ts") ? path.resolve(path.dirname(parent.filename),request) : null;
  if (target) for (const ext of [".ts","/index.ts"]) if(fs.existsSync(target+ext)) return target+ext;
  return resolve.call(this,request,parent,...rest);
};
const base = path.resolve(__dirname,"../src/lib/games/kakure-kanji");
const { STAGES } = require(base+"/data/index.ts");
const P = require(base+"/progress.ts");
const E = require(base+"/engine.ts");
const { applyKanjiAction, actionSchema } = require(base+"/actions.ts");
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log("PASS account "+name)};
const flower=STAGES.find(s=>s.kanji==="花");
const now=Date.parse("2026-10-17T05:00:00Z");
test("初期残高は共通財布。旧残高を加算せず、発見・実績・クリア記録を移行する",()=>{
  const shi=STAGES.find(s=>s.kanji==="思");
  const legacy={...P.defaultSave(),coins:12345,achievements:{first_correct:1},rounds:{[shi.id]:{...E.newRound(shi,1),found:["曰","土","士"],score:300}}};
  const before=structuredClone(legacy);
  const result=applyKanjiAction(null,4321,{type:"initialize",legacy},now);
  assert.equal(result.delta,0);assert.equal(result.save.coins,4321);
  assert.deepEqual(result.save.rounds[shi.id].found,["日","士"]);
  assert.equal(result.save.rounds[shi.id].score,300);
  assert.deepEqual(result.save.achievements,{first_correct:1});assert.deepEqual(legacy,before);
  assert.equal(applyKanjiAction(result.save,4321,{type:"initialize",legacy:P.defaultSave()},now).delta,0);
  assert.equal(applyKanjiAction(null,0,{type:"initialize"},now).save.coins,0);
});
test("既存アカウントも正解の修正を読み直し、発見・ヒントを整理して獲得済みの記録は保つ",()=>{
  for(const [kanji,removed] of [["森",["大","杕"]],["休",["大"]],["体",["大"]],["困",["大","因"]]]){
    const stage=STAGES.find(s=>s.kanji===kanji);
    const old={...E.newRound(stage,1),found:["一",...removed],revealed:removed,hints:Object.fromEntries(removed.map(ch=>[ch,["reading","reveal"]])),score:987,history:removed.map(text=>({text,kind:"correct",at:2}))};
    const record={clears:1,bestStars:3,bestScore:1234,firstClearedAt:1,secretsFound:kanji==="森"?["杕"]:[]};
    const save={...P.defaultSave(),coins:99999,totalPoints:1234,stats:{correct:20,wrong:2},achievements:{first_correct:1},rounds:{[stage.id]:old},stages:{[stage.id]:record}};
    const before=structuredClone(save);
    const out=applyKanjiAction(save,4321,{type:"login"},now);
    assert.deepEqual(out.save.rounds[stage.id].found,["一"]);
    assert.deepEqual(out.save.rounds[stage.id].revealed,[]);assert.deepEqual(out.save.rounds[stage.id].hints,{});assert.deepEqual(out.save.rounds[stage.id].history,[]);
    assert.deepEqual(out.save.stages[stage.id],{...record,secretsFound:[]});
    for(const field of ["totalPoints","stats","achievements"])assert.deepEqual(out.save[field],save[field]);
    assert.equal(out.save.rounds[stage.id].score,987);assert.equal(out.delta,20);assert.equal(out.save.coins,4341);
    assert.deepEqual(save,before);assert.deepEqual(applyKanjiAction(out.save,4341,{type:"login"},now).save,out.save);
  }
});
test("除外により残りの正解が揃ったアカウントは一度だけクリア報酬を受け取る",()=>{
  const stage=STAGES.find(s=>s.kanji==="困");
  const round={...E.newRound(stage,1),found:E.mainAnswers(stage).map(a=>a.char),score:900};
  const stored=P.saveRound(P.defaultSave(),round);
  const action={type:"settings",settings:stored.settings};
  const first=applyKanjiAction(stored,100,action,now);
  assert.ok(first.delta>0);assert.equal(first.save.rounds[stage.id].rewardedAt,now);assert.equal(first.save.stages[stage.id].clears,1);
  const repeated=applyKanjiAction(first.save,first.save.coins,action,now+1);
  assert.equal(repeated.delta,0);assert.deepEqual(repeated.save,first.save);
  const paid={...first.save,rounds:{[stage.id]:{...first.save.rounds[stage.id],found:[...round.found,"大","因"]}}};
  const again=applyKanjiAction(paid,first.save.coins,action,now+2);
  assert.equal(again.delta,0);assert.equal(again.save.stages[stage.id].clears,1);assert.deepEqual(again.save.rounds[stage.id].found,round.found);
});
test("称の旧八の発見とヒントを保って卜を続けて探せる。クリア報酬を二重に渡さない",()=>{
  const stage=STAGES.find(s=>s.kanji==="称"),oldFound=[...E.mainAnswers(stage).map(a=>a.char),"禾"];
  const round={...E.newRound(stage,1),found:oldFound,revealed:["八"],hints:{"八":["reading","reveal"]},score:987,clearedAt:2,rewardedAt:2,completedAt:3};
  const record={clears:1,bestStars:3,bestScore:987,firstClearedAt:2,secretsFound:["禾"]};
  const save={...P.defaultSave(),coins:99999,rounds:{[stage.id]:round},stages:{[stage.id]:record},achievements:{first_correct:1,first_secret:1,all_secrets:1}};
  const before=structuredClone(save);
  const normalized=applyKanjiAction(save,1000,{type:"settings",settings:save.settings},now);
  const resumed=normalized.save.rounds[stage.id];
  assert.equal(normalized.delta,0);assert.equal(resumed.completedAt,null);assert.equal(resumed.clearedAt,2);assert.equal(resumed.rewardedAt,2);assert.equal(resumed.score,987);
  assert.deepEqual(resumed.found,oldFound);assert.deepEqual(resumed.hints,{八:["reading","reveal"]});assert.deepEqual(resumed.revealed,["八"]);
  assert.ok(!resumed.found.includes("卜"),"八を見つけた別の組を卜の発見として引き継がない");
  assert.deepEqual(normalized.save.stages[stage.id],record);assert.deepEqual(save,before);
  const started=applyKanjiAction(normalized.save,1000,{type:"start",stageId:stage.id},now+1);
  assert.equal(started.save.rounds[stage.id].startedAt,1,"リプレイで消さず、前の続きから再開");
  const found=applyKanjiAction(started.save,1000,{type:"submit",stageId:stage.id,strokes:[3,5]},now+2);
  assert.equal(found.event.outcome.result.answer.char,"卜");assert.notEqual(found.save.rounds[stage.id].completedAt,null);assert.equal(found.event.reward,undefined);
  assert.equal(found.delta,P.SECRET_COINS);assert.equal(found.save.stages[stage.id].clears,1);assert.deepEqual(found.save.stages[stage.id].secretsFound,["禾","卜"]);
  const again=applyKanjiAction(found.save,1010,{type:"submit",stageId:stage.id,strokes:[3,5]},now+3);
  assert.equal(again.delta,0);assert.deepEqual(again.save,found.save);
  const unfinished={...E.newRound(stage,1),found:E.mainAnswers(stage).map(a=>a.char)};
  const migrated=applyKanjiAction(P.saveRound(P.defaultSave(),unfinished),1000,{type:"settings",settings:save.settings},now);
  assert.equal(migrated.save.rounds[stage.id].rewardedAt,now);assert.ok(migrated.delta>0);
  assert.equal(applyKanjiAction(migrated.save,migrated.save.coins,{type:"settings",settings:save.settings},now+1).delta,0);
});
test("八が追加された報酬済みラウンドは得点だけ加算し、クリア数とコインを二重に増やさない",()=>{
  for(const kanji of ["称","想","謝","村"]){
    const stage=STAGES.find(s=>s.kanji===kanji),found=stage.answers.map(a=>a.char).filter(ch=>ch!=="八");
    const record={clears:1,bestStars:3,bestScore:987,firstClearedAt:2,secretsFound:E.secretAnswers(stage).map(a=>a.char)};
    const save={...P.defaultSave(),coins:99999,totalPoints:987,rounds:{[stage.id]:{...E.newRound(stage,1),found,score:987,clearedAt:2,rewardedAt:2,completedAt:3}},stages:{[stage.id]:record},achievements:{first_correct:1}};
    const normalized=applyKanjiAction(save,1000,{type:"start",stageId:stage.id},now);
    const round=normalized.save.rounds[stage.id];assert.equal(round.startedAt,1);assert.equal(round.completedAt,null);assert.equal(round.rewardedAt,2);assert.equal(normalized.delta,0);
    const out=applyKanjiAction(normalized.save,1000,{type:"submit",stageId:stage.id,strokes:stage.answers.find(a=>a.char==="八").strokeSets[0]},now+1);
    const points=out.event.outcome.gained.points;
    assert.equal(out.event.outcome.result.answer.char,"八");assert.equal(out.event.reward,null);assert.equal(out.delta,0);
    assert.equal(out.save.totalPoints,987+points);assert.equal(out.save.rounds[stage.id].score,987+points);assert.equal(out.save.stages[stage.id].bestScore,987+points);assert.equal(out.save.stages[stage.id].clears,1);
    assert.notEqual(out.save.rounds[stage.id].completedAt,null);
    const replay=applyKanjiAction(out.save,1000,{type:"submit",stageId:stage.id,strokes:stage.answers.find(a=>a.char==="八").strokeSets[0]},now+2);
    assert.equal(replay.delta,0);assert.deepEqual(replay.save,out.save);
  }
  const stage=STAGES.find(s=>s.kanji==="称"),found=stage.answers.map(a=>a.char).filter(ch=>!["八","卜"].includes(ch));
  const record={clears:1,bestStars:3,bestScore:987,firstClearedAt:2,secretsFound:["禾"]};
  const save={...P.defaultSave(),totalPoints:987,rounds:{[stage.id]:{...E.newRound(stage,1),found,score:987,clearedAt:2,rewardedAt:2,completedAt:3}},stages:{[stage.id]:record},achievements:{first_correct:1,first_secret:1,all_secrets:1}};
  const secret=applyKanjiAction(save,1000,{type:"submit",stageId:stage.id,strokes:[3,5]},now);
  assert.equal(secret.save.rounds[stage.id].clearedAt,null,"八をまだ探している");assert.equal(secret.delta,P.SECRET_COINS);
  assert.equal(secret.save.totalPoints,987+secret.event.outcome.gained.points,"以前のクリア済みラウンドへのシークレット得点も失わない");
});
test("ログインはサーバーの日本時間で1日1回。端末の残高を使わない",()=>{
  let out=applyKanjiAction(P.defaultSave(),100,{type:"login"},now);
  assert.equal(out.delta,20);assert.equal(out.save.coins,120);
  assert.equal(applyKanjiAction(out.save,333,{type:"login"},now).delta,0);
  out=applyKanjiAction(out.save,333,{type:"login"},Date.parse("2026-10-17T15:00:00Z"));
  assert.equal(out.delta,25);assert.equal(out.save.login.streak,2);
});
test("全24問の正解・クリア・シークレットが共通財布の差分になる",()=>{
  for(const stage of STAGES){
    let save=applyKanjiAction(null,1000,{type:"initialize"},now).save,balance=1000;
    const act=a=>{const out=applyKanjiAction(save,balance,a,now+1);balance+=out.delta;save=out.save;assert.equal(save.coins,balance);return out;};
    act({type:"start",stageId:stage.id});
    for(const a of E.mainAnswers(stage)) act({type:"submit",stageId:stage.id,strokes:a.strokeSets[0]});
    assert.notEqual(save.rounds[stage.id].rewardedAt,null);
    for(const a of E.secretAnswers(stage)) act({type:"submit",stageId:stage.id,strokes:a.strokeSets[0]});
    assert.notEqual(save.rounds[stage.id].completedAt,null);
    const same=act({type:"submit",stageId:stage.id,strokes:stage.answers[0].strokeSets[0]});assert.equal(same.delta,0);
    const before=structuredClone(save);
    act({type:"reset"});
    assert.deepEqual(save.stages,before.stages);assert.deepEqual(save.achievements,before.achievements);
    assert.equal(save.coins,before.coins);assert.deepEqual(save.rounds,{});
  }
});
test("正解ごとの報酬は固定。花の通常全発見170枚、初シークレット80枚、重複0枚",()=>{
  let save=applyKanjiAction(null,100,{type:"initialize"},now).save,balance=100;
  const act=a=>{const out=applyKanjiAction(save,balance,a,now+1);balance+=out.delta;save=out.save;return out;};
  act({type:"start",stageId:flower.id});
  for(const a of E.mainAnswers(flower))act({type:"submit",stageId:flower.id,strokes:a.strokeSets[0]});
  assert.equal(balance,270);
  const secret=E.secretAnswers(flower)[0];const out=act({type:"submit",stageId:flower.id,strokes:secret.strokeSets[0]});
  assert.equal(out.delta,80);assert.equal(out.event.secretCoins,10);assert.equal(balance,350);
  assert.equal(act({type:"submit",stageId:flower.id,strokes:secret.strokeSets[0]}).delta,0);
});
test("ヒントは固定額で1回。残高不足・存在しない字・同じヒントでは記録も動かない",()=>{
  let save=applyKanjiAction(null,20,{type:"initialize"},now).save;
  save=applyKanjiAction(save,20,{type:"start",stageId:flower.id},now).save;
  const action={type:"hint",stageId:flower.id,answer:"化",kind:"reading"};
  const result=applyKanjiAction(save,20,action,now);assert.equal(result.delta,-10);assert.deepEqual(result.save.rounds[flower.id].hints["化"],["reading"]);
  assert.throws(()=>applyKanjiAction(result.save,10,action,now),/もう使え/);
  const before=structuredClone(save);assert.throws(()=>applyKanjiAction(save,0,action,now),/足りません/);assert.deepEqual(save,before);
  assert.throws(()=>applyKanjiAction(save,20,{...action,answer:"曰"},now));
  assert.equal(actionSchema.safeParse({...action,coins:999999}).data.coins,undefined);
});

// The real Next route is exercised with session and database fixtures. HMACs are
// verified with node:crypto; SQL atomicity/RLS is checked separately against PG.
const userId="11111111-1111-4111-8111-111111111111";
const secret="test-only-signing-key-".padEnd(64,"x");
process.env.KAKURE_KANJI_WALLET_SECRET=secret;process.env.VERCEL_ENV="preview";
let state={save:null,revision:0,balance:100},session={id:userId};
const receipts=new Map();let commits=0;
const db={
  from(table){return{select(){return{eq(col,id){const get=()=>({data:table==="user_blue_coins"?[{balance:state.balance}]:state.save?{save:state.save,revision:state.revision}:null,error:null});return{maybeSingle:async()=>get(),then:resolve=>Promise.resolve(get()).then(resolve)};}}}};},
  async rpc(name,args){
    if(name==="get_kakure_kanji_receipt")return{data:receipts.get(args.p_request_id)??null,error:null};
    assert.equal(name,"commit_kakure_kanji");
    assert.equal(args.p_signature,crypto.createHmac("sha256",secret).update(args.p_payload).digest("hex"));
    const p=JSON.parse(args.p_payload);assert.equal(p.userId,userId);
    if(receipts.has(p.requestId))return{data:{snapshot:state,event:receipts.get(p.requestId),replayed:true},error:null};
    if(p.revision!==state.revision)return{data:null,error:{message:"KANJI_CONFLICT"}};
    const balance=state.balance+p.delta;if(balance<0)return{data:null,error:{message:"BLUE_COINS_SHORT"}};
    state={save:{...p.save,coins:balance},revision:state.revision+1,balance};receipts.set(p.requestId,p.event);commits++;
    return{data:{snapshot:state,event:p.event},error:null};
  },
};
const load=Module._load;
Module._load=function(request,parent,...rest){if(request==="@/lib/supabase/server")return{requireUser:async()=>{if(!session)throw new Error("LOGIN_REQUIRED");return{supabase:db,user:session};}};return load.call(this,request,parent,...rest);};
const route=require(path.resolve(__dirname,"../src/app/api/games/kakure-kanji/route.ts"));
const post=async(action,extra={})=>{
  const body={userId,requestId:crypto.randomUUID(),revision:state.revision,action,...extra};
  const response=await route.POST(new Request("https://odekake.test/api/games/kakure-kanji",{method:"POST",headers:{origin:"https://odekake.test","Content-Type":"application/json"},body:JSON.stringify(body)}));
  return{status:response.status,body:await response.json(),request:body};
};
async function routeTests(){
  let result=await post({type:"initialize",legacy:{...P.defaultSave(),coins:99999}});assert.equal(result.status,200);assert.equal(result.body.snapshot.balance,100);
  const requestId=crypto.randomUUID();result=await post({type:"login"},{requestId});assert.equal(result.status,200);assert.equal(state.balance,120);
  const count=commits;result=await post({type:"login"},{requestId,revision:0});assert.equal(result.status,200);assert.equal(result.body.replayed,true);assert.equal(commits,count);assert.equal(state.balance,120);
  result=await post({type:"start",stageId:flower.id},{revision:0});assert.equal(result.status,409);assert.equal(commits,count);
  result=await post({type:"start",stageId:flower.id});assert.equal(result.status,200);
  result=await post({type:"hint",stageId:flower.id,answer:"化",kind:"reading",coins:999999});assert.equal(result.status,200);assert.equal(state.balance,110);
  const snapshot=structuredClone(state);result=await post({type:"hint",stageId:flower.id,answer:"化",kind:"reading"});assert.equal(result.status,400);assert.deepEqual(state,snapshot);
  result=await post({type:"login"},{userId:"22222222-2222-4222-8222-222222222222"});assert.equal(result.status,403);assert.deepEqual(state,snapshot);
  const get=await route.GET(new Request("https://odekake.test/api/games/kakure-kanji?account="+userId));assert.equal(get.status,200);assert.equal((await get.json()).snapshot.balance,110);
  assert.equal((await route.GET(new Request("https://odekake.test/api/games/kakure-kanji?account=other"))).status,403);
  assert.equal((await route.POST(new Request("https://odekake.test/api/games/kakure-kanji",{method:"POST",headers:{origin:"https://evil.test"},body:"{}"}))).status,403);
  session=null;await assert.rejects(()=>route.GET(new Request("https://odekake.test/api/games/kakure-kanji?account="+userId)),/LOGIN_REQUIRED/);
  console.log("PASS account 実際のAPI：認証・他人の操作拒否・署名・重複再送・リビジョン競合・固定ヒント代・残高読み取り");
  console.log(`${passed+1} account tests passed`);
}
if(require.main===module)routeTests().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={route,db,userId,getState:()=>state,reset:(next)=>{state=next;receipts.clear();session={id:userId};},post};
