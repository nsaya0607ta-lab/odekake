const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const mod={exports:{}};new Function('exports','module',ts.transpileModule(fs.readFileSync('src/lib/games/town-touch-controls.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod.exports,mod);
const {TownTouchControls}=mod.exports;
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS '+name)};
const point=(extra={})=>({pointerId:1,pointerType:'touch',isPrimary:true,clientX:20,clientY:20,...extra});
const button=()=>({isConnected:true,disabled:false,clicks:0,matches(){return this.disabled},getBoundingClientRect(){return{left:0,top:0,right:50,bottom:50}},click(){this.clicks++}});
test('a stationary touch activates even when the browser omits its compatibility click',()=>{
 const c=new TownTouchControls(),b=button();c.start(b,point());c.end(point());assert.equal(b.clicks,1);c.end(point());assert.equal(b.clicks,1);
});
test('the follow-up native touch click is suppressed once, without suppressing the manual activation',()=>{
 const c=new TownTouchControls(),b=button();b.click=function(){assert.equal(c.suppressClick(0),false);this.clicks++};c.start(b,point());c.end(point());assert.equal(c.suppressClick(1,'touch'),true);assert.equal(c.suppressClick(1,'touch'),false);assert.equal(b.clicks,1);
});
test('scrolling over a purchase button does not purchase on release',()=>{
 const c=new TownTouchControls(),b=button();c.start(b,point());c.move(point({clientY:40}));c.move(point());c.end(point());assert.equal(b.clicks,0);
});
test('releasing outside a control or cancelling a touch cannot activate it',()=>{
 const c=new TownTouchControls(),b=button();c.start(b,point());c.end(point({clientX:60}));c.start(b,point());c.cancel(1);c.end(point());assert.equal(b.clicks,0);c.start(b,point());c.end(point());assert.equal(b.clicks,1);
});
test('disabled and removed controls never activate',()=>{
 const c=new TownTouchControls(),b=button();b.disabled=true;c.start(b,point());c.end(point());b.disabled=false;c.start(b,point());b.isConnected=false;c.end(point());assert.equal(b.clicks,0);
});
test('two separate deliberate taps activate once each',()=>{
 const c=new TownTouchControls(),b=button();for(let i=0;i<2;i++){c.start(b,point({pointerId:i+1}));c.end(point({pointerId:i+1}));assert(c.suppressClick(1,'touch',i+1))}assert.equal(b.clicks,2);
});
test('mouse, keyboard and assistive clicks remain available after touch',()=>{
 const c=new TownTouchControls(),b=button();c.start(b,point());c.end(point());assert.equal(c.suppressClick(0),false);c.start(b,point({pointerType:'mouse'}));assert.equal(c.suppressClick(1,'mouse'),false);c.end(point({pointerType:'mouse'}));assert.equal(b.clicks,1);
});
test('a second finger or a release from an unrelated pointer does not activate a control',()=>{
 const c=new TownTouchControls(),b=button();c.start(b,point());c.end(point({pointerId:2}));assert.equal(b.clicks,0);c.start(b,point({pointerId:2,isPrimary:false}));c.end(point({pointerId:2,isPrimary:false}));assert.equal(b.clicks,0);
});
test('a later native click or unrelated pointer is never discarded',()=>{
 let now=0;const c=new TownTouchControls(()=>now),b=button();c.start(b,point());c.end(point());assert.equal(c.suppressClick(1,'touch',2),false);now=1000;assert.equal(c.suppressClick(1,'touch'),false);
});

test('a delayed click stays suppressed after the original button is removed or another is exposed',()=>{const c=new TownTouchControls(),b=button();c.start(b,point());c.end(point());b.isConnected=false;assert(c.suppressClick(1,'touch',1));});

test('Safari compatibility mouse clicks are deduplicated without PointerEvent fields',()=>{const c=new TownTouchControls(),b=button();c.start(b,point());c.end(point());assert(c.suppressClick(1));assert.equal(c.suppressClick(0),false);});
test('blur or resize cancels a held control and suppresses its delayed native click',()=>{const c=new TownTouchControls(),b=button();c.start(b,point());c.cancel();c.end(point());assert.equal(b.clicks,0);assert(c.suppressClick(1,'touch',1));c.start(b,point());c.end(point());assert.equal(b.clicks,1);});

test('a long confirmation dialog does not let its delayed click activate the next screen',()=>{let now=0;const c=new TownTouchControls(()=>now),b=button();b.click=function(){this.clicks++;now=5000};c.start(b,point());c.end(point());now=5001;assert(c.suppressClick(1,'touch',1));assert.equal(b.clicks,1);});
test('slow layout never replays an identified touch, and a fresh gesture still activates normally',()=>{let now=0;const c=new TownTouchControls(()=>now),b=button();c.start(b,point());c.end(point());now=3000;assert(c.suppressClick(1,'touch',1));assert.equal(c.suppressClick(1,'touch',1),false);c.start(b,point({pointerId:2}));c.end(point({pointerId:2}));assert.equal(b.clicks,2);assert(c.suppressClick(1,'touch',2));});
console.log(count+' town touch-control checks passed');
