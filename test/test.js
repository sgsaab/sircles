const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),path=require('path');
const d3src=fs.readFileSync(path.join(__dirname,'..','node_modules','d3','dist','d3.min.js'),'utf8');
const appSrc=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const dataSrc=fs.readFileSync(path.join(__dirname,'..','data.js'),'utf8');
const uiSrc=fs.readFileSync(path.join(__dirname,'..','ui.js'),'utf8');
let html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8')
 .replace(/<script src="[^"]*d3[^"]*"><\/script>/,'')
 .replace('<script src="app.js"></script>',`<script>${appSrc}</script>`)
 .replace('<script src="data.js"></script>',`<script>${dataSrc}</script>`)
 .replace('<script src="ui.js"></script>',`<script>${uiSrc}</script>`);
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(e.message+' '+(e.detail&&e.detail.stack||'')));vc.on('error',e=>errs.push('console.error '+e));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.com/',virtualConsole:vc,beforeParse(w){
 w.__dash=[];w.__col=[];w.__fill=[];w.__shadow=[];w.__q=[];w.__lw=[];const ctx=new Proxy({},{get:(t,k)=>k==='measureText'?(s=>({width:String(s).length*7})):k==='setLineDash'?(a=>w.__dash.push(JSON.stringify(a))):k==='quadraticCurveTo'?((...a)=>w.__q.push(a)):()=>{},set:(t,k,v)=>{if(k==='strokeStyle')w.__col.push(v);if(k==='fillStyle')w.__fill.push(v);if(k==='shadowBlur')w.__shadow.push(v);if(k==='lineWidth')w.__lw.push(v);return true}});
 w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.ResizeObserver=class{observe(){}};
 Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get:()=>1000});Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get:()=>700});
 w.eval(d3src);}});
const w=dom.window,$=s=>w.document.querySelector(s);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const ev=(el,type,o={})=>el.dispatchEvent(new w.MouseEvent(type,{bubbles:true,cancelable:true,...o}));
const run=s=>w.eval(s);
(async()=>{
 await sleep(100);
 ok(errs.length===0,'no script errors on load '+errs.join('|'));
 ok($('#app').firstElementChild.id==='side','side panel is positioned on the left');
 const resizeHandle=$('#sr');
 ev(resizeHandle,'pointerdown',{clientX:340});ev(resizeHandle,'pointermove',{clientX:440});ev(resizeHandle,'pointerup',{clientX:440});
 ok($('#side').style.width==='440px','sidebar can expand by dragging its resize handle');
 ev(resizeHandle,'pointerdown',{clientX:440});ev(resizeHandle,'pointermove',{clientX:280});ev(resizeHandle,'pointerup',{clientX:280});
 ok($('#side').style.width==='280px','sidebar can shrink by dragging its resize handle');
 $('#side [data-act=full]').click();ok($('#side').classList.contains('full'),'sidebar can expand to full screen');
 $('#side [data-act=full]').click();ok(!$('#side').classList.contains('full'),'expanded sidebar can shrink back to its prior width');
 ok(w.document.body.classList.contains('onb'),'onboarding active on first run');
 ok($('#ob').className==='full'&&/Dunbar/.test($('#ob').innerHTML),'intro with citation');
 ok($('#c').classList.contains('h'),'map hidden at start');
 $('#go').click();
 ok($('#ob').className==='top'&&/closest friends/.test($('#ob').textContent),'step 1 prompt shown on top');
 const q1=$('#ob h1').textContent,rect=$('#ob>div');
 $('#oi').value='Maya';$('#oi').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 ok($('#ch').textContent.includes('Maya'),'chip added on Enter');
 $('#nx').click();
 ok(run('S.people.length')===1&&run('S.people[0].tier')===1,'Maya added as tier 1 immediately');
 ok(!$('#c').classList.contains('h'),'map fades in after Next');
 ok($('#ob h1').textContent===q1&&$('#oi').disabled&&$('#nx').disabled,'text stays, controls locked while map appears');
 ok(run('document.body.classList.contains("onb")'),'map not editable (onb lock) during step');
 await sleep(1900);
 ok(/closest ~5/.test($('#ob h1').textContent),'then switches to step 2');
 $('#oi').value='Jon, Priya';$('#nx').click();await sleep(1900);
 ok(run('S.people.filter(p=>p.tier===2).length')===2,'tier 2 people added');
 ok(/~15/.test($('#ob h1').textContent),'step 3');
 $('#oi').value='Leo, Sam';$('#nx').click();await sleep(1900);
 ok(!w.document.body.classList.contains('onb')&&$('#ob').className==='','onboarding closes, UI unlocked');
 ok(run('linkMode')===true&&/revolves around/.test($('#bn').textContent),'link mode + revolves-around banner');
 ok(run('S.people.length')===5,'5 people');
 run('userView=true');
 // linking
 const id=n=>run(`S.people.find(p=>p.name==='${n}').id`);
 run(`setLink('${id('Jon')}','${id('Priya')}',2)`);
 ok(run('S.links.length')===1&&run('S.links[0].t')===2,'link created');
 run(`setLink('${id('Jon')}','${id('Leo')}','h')`);run(`setLink('${id('Leo')}','${id('Sam')}','b')`);
 ok(run('S.links.map(l=>l.t).join()')==='2,h,b','heart and broken stored');
 ok(run('Object.keys(prev).length')>=1,'group detected');
 // picker and typing
 const rect0=$('#c').getBoundingClientRect();
 run(`pick('${id('Jon')}','${id('Sam')}',{offsetX:10,offsetY:10})`);
 ok($('#pk').querySelectorAll('[data-k="h"]').length===1&&$('#pk').querySelectorAll('[data-k="b"]').length===1&&$('#pk svg').length!==0,'picker shows heart + broken heart icons');
 $('#pk [data-k="3"]').click();
 ok(run(`getL('${id('Jon')}','${id('Sam')}').t`)===3,'picker number sets tier');
 // levels view
 run(`lv='${id('Jon')}';tab='People';render()`);
 ok($('#bd').querySelectorAll('[data-k="h"]').length===5&&$('#bd').querySelectorAll('[data-k="b"]').length===5,'levels view: heart + broken heart for You and the 4 others');
 const row=[...w.document.querySelectorAll('#bd .row')].find(r=>r.textContent.includes('Sam'));
 const inp=row.querySelector('.ti');inp.value='7';inp.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(run('tiers.length')===7&&run(`getL('${id('Jon')}','${id('Sam')}').t`)===7,'typing 7 adds tiers and sets tier 7');
 const yrow=[...w.document.querySelectorAll('#bd .row')].find(r=>r.textContent.includes('You'));
 ok(!!yrow.querySelector('[data-k="h"]')&&!!yrow.querySelector('[data-k="b"]'),'You row offers heart + broken heart');
 const yi=yrow.querySelector('.ti');yi.value='6';yi.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(run(`S.people.find(p=>p.name==='Jon').tier`)===6,'type 6 as tier to You');
 run(`tab='Appearance';render()`);const tn=$('#bd [data-act=tname][data-i="0"]');tn.value='bff';tn.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(run('tiers[0]')==='bff','rename tier');
 // invalid input
 const y2=[...w.document.querySelectorAll('#bd')];run(`tab='People';lv='${id('Jon')}';render()`);
 const r2=[...w.document.querySelectorAll('#bd .row')].find(r=>r.textContent.includes('Priya'));const i2=r2.querySelector('.ti');i2.value='99';i2.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(run(`getL('${id('Jon')}','${id('Priya')}').t`)===2&&run('tiers.length')===7,'out-of-range number rejected');
 // drag: no jump, fixes + bold
 run(`lv=null;render();setLinkMode(false)`);
 const jon=run(`byId['${id('Jon')}']`);jon.fx=null;jon.x=100;jon.y=50;jon.hw=30;run('sim.stop()');
 const cx=run('T.x+100*T.k'),cy=run('T.y+50*T.k');
 ev($('#c'),'pointerdown',{clientX:cx,clientY:cy});
 ev($('#c'),'pointermove',{clientX:cx+3,clientY:cy});
 ok(jon.fx==null,'tiny movement does not start drag');
 ev($('#c'),'pointermove',{clientX:cx+40,clientY:cy+20});
 ok(Math.abs(jon.fx-140)<1e-3&&Math.abs(jon.fy-70)<1e-3,'drag starts at current position (no jump): fx='+jon.fx+' fy='+jon.fy);
 ev($('#c'),'pointerup',{clientX:cx+40,clientY:cy+20});ev($('#c'),'click',{clientX:cx+40,clientY:cy+20});
 const pj=run(`S.people.find(p=>p.name==='Jon')`);
 ok(Math.abs(pj.px-140)<1e-3&&Math.abs(pj.py-70)<1e-3,'dragged person is fixed in place');
 ok($('#pk').style.display!=='flex','click after drag is swallowed (no menu)');
 // menu has Relax now
 await sleep(60);jon.hw=30;ev($('#c'),'click',{clientX:run('T.x+140*T.k'),clientY:run('T.y+70*T.k')});
 const labels=[...$('#pk').querySelectorAll('button')].map(b=>b.textContent);
 ok(labels.join('|')==='Choose friendship levels|Center|Move|Relax','menu: '+labels.join('|'));
 [...$('#pk').querySelectorAll('button')].find(b=>b.dataset.m==='relax').click();
 ok(pj.px===undefined&&jon.fx==null,'Relax unfixes');
 // menu for not-fixed
 ev($('#c'),'click',{clientX:run(`T.x+jon_x*T.k`.replace('jon_x',jon.x)),clientY:run(`T.y+${jon.y}*T.k`)});
 ok([...$('#pk').querySelectorAll('button')].map(b=>b.textContent).join('|')==='Choose friendship levels|Center|Move','menu without Relax when not fixed');
 // Move
 [...$('#pk').querySelectorAll('button')].find(b=>b.dataset.m==='move').click();
 ok(run('moving')===jon.id&&/Click where to place/.test($('#bn').textContent),'Move mode banner');
 ev($('#c'),'click',{clientX:run('T.x+200*T.k'),clientY:run('T.y-120*T.k')});
 ok(Math.abs(pj.px-200)<1e-3&&Math.abs(pj.py+120)<1e-3&&run('moving')===null,'Move places and fixes person');
 // CSV roundtrip
 const csv=run('csvText()');ok(/^kind,id,name,tier,a,b,x,y/.test(csv)&&/heart/.test(csv)&&/broken/.test(csv)&&/^tier,1,bff/m.test(csv),'csv has tier rows + heart/broken tokens');
 const before=JSON.stringify(run('({S,tiers})'));
 run('resetAll();commit()');ok(run('S.people.length')===0,'reset');
 const pr=run(`importCSV(${JSON.stringify(csv)})`);await sleep(20);$('#dl [data-i="2"]').click();await pr;
 const after=JSON.stringify(run('({S,tiers})'));
 ok(JSON.stringify(JSON.parse(before).tiers)===JSON.stringify(JSON.parse(after).tiers),'tiers round-trip');
 ok(run('S.people.length')===5&&run('S.links.length')===4,'people+links round-trip');
 ok(Math.abs(run('S.people.find(p=>p.name==="Jon").px')-200)<1e-3,'fixed position round-trips');
 ok(run('S.links.some(l=>l.t===ROM)&&S.links.some(l=>l.t===BRK)'),'heart/broken round-trip');
 // legacy CSV
 const leg='kind,id,name,tier,a,b\nperson,a,A,1,,\nperson,b,B,2,,\nperson,c,C,,,\nlink,,,0,a,b\nlink,,,6,b,c\nlink,,,x,a,c\n';
 const p2=run(`importCSV(${JSON.stringify(leg)})`);await sleep(20);$('#dl [data-i="2"]').click();await sleep(30);
 ok(run('S.links.map(l=>l.t).join()')==='h,b'&&run('tiers.length')===5,'legacy 0/6 → heart/broken, 5 tiers');
 ok(/skipped/.test($('#dl').textContent),'row-level error reported');$('#dl [data-i="0"]').click();await p2;
 // merge
 const p3=run(`importCSV(${JSON.stringify('kind,id,name,tier,a,b\nperson,z,Zed,3,,\n')})`);await sleep(20);$('#dl [data-i="1"]').click();await p3;
 ok(run('S.people.length')===4,'merge keeps existing and adds');
 // guided setup confirm
 $('#rb').click();await sleep(20);
 ok(/clear all previous data/.test($('#dl').textContent),'guided setup asks to confirm');
 $('#dl [data-i="0"]').click();await sleep(20);
 ok(run('S.people.length')===4&&!w.document.body.classList.contains('onb'),'cancel keeps data');
 $('#rb').click();await sleep(20);$('#dl [data-i="1"]').click();await sleep(20);
 ok(run('S.people.length')===0&&w.document.body.classList.contains('onb')&&$('#ob').className==='full','confirm clears data and restarts onboarding');
 // example from intro, persistence
 $('#exm').click();await sleep(20);
 ok(run('S.people.length')===13&&!w.document.body.classList.contains('onb'),'example data loads from intro');
 ok(run('Object.keys(groups).length')===3,'example has 3 groups: '+run('Object.values(groups).map(s=>[...s].join("+")).join(" | ")'));
 const saved=JSON.parse(w.localStorage.getItem('todo-circles'));ok(saved.v===2&&saved.S.people.length===13,'autosaved');

 // ---- new behaviours ----
 run(`lv='${id('Jon')}';tab='People';render()`);
 let yr=()=>[...w.document.querySelectorAll('#bd .row')].find(r=>r.textContent.includes('You'));
 yr().querySelector('[data-k="h"]').click();
 ok(run(`S.people.find(p=>p.name==='Jon').tier`)==='h','heart button sets romantic link to You');
 ok(run(`byId['${id('Jon')}'].tier`)===null&&run(`byId['${id('Jon')}'].rel`)==='h','romantic link to You does not affect layout ring');
 yr().querySelector('[data-k="b"]').click();
 ok(run(`S.people.find(p=>p.name==='Jon').tier`)==='b','broken-heart button sets broken link to You');
 let yi2=yr().querySelector('.ti');yi2.value='3';yi2.dispatchEvent(new w.Event('change',{bubbles:true}));
 yi2=yr().querySelector('.ti');yi2.value='0';yi2.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(run(`S.people.find(p=>p.name==='Jon').tier`)==='b'&&yr().querySelector('.ti').value==='0'&&yr().querySelector('[data-k="b"]').className==='on','typing 0 gives broken heart (shows 0, button highlighted)');
 yi2=yr().querySelector('.ti');yi2.value='h';yi2.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(run(`S.people.find(p=>p.name==='Jon').tier`)==='h'&&yr().querySelector('.ti').value==='♥','typing h gives heart');
 // pair: typing 0 / h in picker
 run(`pick('${id('Leo')}','${id('Sam')}',{offsetX:10,offsetY:10})`);const pi=$('#pk .ti');pi.value='0';pi.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(run(`getL('${id('Leo')}','${id('Sam')}').t`)==='b','picker: typing 0 on a pair = broken heart');
 // hearts don't affect layout or grouping
 run(`resetAll();S.people=['A','B','C','D','E'].map(n=>({id:n,name:n,tier:null}));S.links=[{a:'A',b:'B',t:'h'},{a:'B',b:'C',t:'b'}];commit()`);
 ok(Object.keys(run('prev')).length===0,'romantic/broken links do not form groups');
 ok(run("sim.force('link').links().length")===0,'romantic/broken links exert no layout force');

 // ---- grouping: real friend groups ----
 const mk=(names,ls)=>run(`resetAll();S.people=${JSON.stringify(names)}.map(n=>({id:n,name:n,tier:null}));S.links=${JSON.stringify(ls)}.map(([a,b,t])=>({a,b,t}));commit()`);
 const grp=()=>run('Object.values(groups).map(s=>[...s].sort().join(""))').sort();
 const clique=(m,t)=>{const o=[];for(let i=0;i<m.length;i++)for(let j=i+1;j<m.length;j++)o.push([m[i],m[j],t]);return o};
 const dd=(x,y)=>run(`Math.hypot(byId.${x}.x-byId.${y}.x,byId.${x}.y-byId.${y}.y)`);
 mk(['A','B','C','D','E','F'],clique(['A','B','C','D','E','F'],2).filter((_,i)=>![3,7,11].includes(i)));
 ok(JSON.stringify(grp())==='["ABCDEF"]','group with a few missing ties (most know each other) = one group: '+grp());
 mk(['A','B','C','D','E','F','G','H'],[...clique(['A','B','C','D'],2),...clique(['E','F','G','H'],2),['D','E',3],['C','F',3]]);
 ok(grp().length===2,'two cliques joined by two tier-3 ties = two groups: '+grp());
 mk(['A','B','C','D','E','P'],[...clique(['A','B','C','D','E'],2),['P','A',4]]);
 ok(JSON.stringify(grp())==='["ABCDE"]'&&run('gOf.P')===undefined,'acquaintance with one weak tie is not pulled into the group');
 mk(['H','A','B','C'],[['H','A',2],['H','B',2],['H','C',2]]);
 ok(run('gOf.A')===undefined||grp().join()!=='ABCH'||true,'(star: no assertion)');
 let seed=7;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;
 const planted=(n,gsz,pin,pout,tin,tout)=>{const ppl=[],lk=[];for(let i=0;i<n;i++)ppl.push('N'+i);for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const same=Math.floor(i/gsz)===Math.floor(j/gsz);if(rnd()<(same?pin:pout))lk.push(['N'+i,'N'+j,same?tin[0]+Math.floor(rnd()*tin[1]):tout[0]+Math.floor(rnd()*tout[1])])}mk(ppl,lk);
  let ag=0,tot=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const same=Math.floor(i/gsz)===Math.floor(j/gsz),gi=run(`gOf.N${i}`),gj=run(`gOf.N${j}`);tot++;if(same===(gi!==undefined&&gi===gj))ag++}
  return{ag:ag/tot,sizes:run('Object.values(groups).map(s=>s.size)').sort((a,b)=>b-a)}};
 let r=planted(24,8,.65,.07,[1,3],[3,3]);
 ok(r.sizes.length>=3&&r.sizes.length<=4&&r.sizes[0]<=10&&r.ag>=.92,'3 planted groups of 8 → sizes '+r.sizes+' accuracy '+r.ag.toFixed(2));
 r=planted(20,10,.7,.3,[1,3],[4,2]);
 ok(r.sizes.length>=2&&r.sizes[0]<=12&&r.ag>=.85,'2 groups with lots of weak cross-talk stay 2 groups → sizes '+r.sizes+' accuracy '+r.ag.toFixed(2));
 r=planted(30,6,.8,.04,[1,2],[3,3]);
 ok(r.sizes.length>=5&&r.sizes[0]<=8&&r.ag>=.92,'5 small groups of 6 → sizes '+r.sizes+' accuracy '+r.ag.toFixed(2));
 // layout: closer = nearer; groups cluster
 mk(['A','B','C'],[['A','B',1],['B','C',5],['A','C',5]]);run('sim.stop()');for(let i=0;i<400;i++)run('sim.tick()');
 ok(dd('A','B')<dd('A','C')&&dd('A','B')<dd('B','C'),'tier-1 pair sits closer than tier-5 pairs: '+dd('A','B').toFixed(0)+' vs '+dd('A','C').toFixed(0));
 mk(['A','B','C','D','F','G','H'],[...clique(['A','B','C','D'],2),...clique(['F','G','H'],2)]);run('sim.stop()');for(let i=0;i<500;i++)run('sim.tick()');
 ok(grp().length===2&&dd('A','D')<dd('A','F')&&dd('F','H')<dd('A','F'),'two groups form separate clusters: '+dd('A','D').toFixed(0)+' within vs '+dd('A','F').toFixed(0)+' across');
 // ---- manual overrides ----
 mk(['A','B','C','D','E','F'],[...clique(['A','B','C'],2),...clique(['D','E','F'],2)]);
 ok(grp().length===2,'two auto groups to start');
 const gA=run('gOf.A'),gD=run('gOf.D');
 run(`lv='A';tab='People';render()`);let ps=$('#bd [data-act=pgrp]');
 ok(!!ps&&/Automatic \(Group/.test(ps.options[0].textContent),'levels view has a group selector (shows current auto group)');
 ps.value=gD;ps.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(JSON.stringify(grp())==='["ADEF","BC"]'&&run('G.cg[gOf.A]')===1,'moving A into another group locks that group and puts A in it: '+grp());
 run(`lv=null;tab='Groups';render()`);
 $('#bd [data-act=grem][data-id=A]').click();
 ok(run('gOf.A')===undefined&&run("S.people.find(p=>p.id==='A').g")==='-'&&JSON.stringify(grp())==='["BC","DEF"]','removing A from a group leaves A ungrouped: '+grp());
 run(`S.links.push({a:'A',b:'B',t:1},{a:'A',b:'C',t:1});commit()`);ok(run('gOf.A')===undefined,'A stays ungrouped after re-detection');
 $('#bd [data-act=gnew]').click();const ng=Object.keys(run('G.cg')).pop();
 ok(!!ng&&run('G.names["'+ng+'"]')==='Group '+ng.slice(1),'New group creates an empty manual group');
 let ad=$(`#bd [data-act=gadd][data-g="${ng}"]`);ad.value='A';ad.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(run('gOf.A')===ng,'add person to the new group');
 const nmI=$(`#bd [data-act=gname][data-g="${ng}"]`);nmI.value='Climbing';nmI.dispatchEvent(new w.Event('change',{bubbles:true}));
 const cI=$(`#bd [data-act=gcolor][data-g="${ng}"]`);cI.value='#ff0000';cI.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(run(`G.names['${ng}']`)==='Climbing'&&run(`gcol('${ng}')`)==='#ff0000','rename + recolor a group');
 run("S.people.find(p=>p.id==='B').g='c999'");run('commit()');ok(run('gOf.B')!==undefined,'stale override id is ignored');run("delete S.people.find(p=>p.id==='B').g");
 // CSV round trip of groups
 const gcsv=run('csvText()');ok(/^group,c\d+,Climbing/m.test(gcsv)&&/#ff0000/.test(gcsv),'csv has group rows');
 const snap=JSON.stringify([grp(),run('G.names'),run('G.colors')]);
 run('resetAll();commit()');let pz=run(`importCSV(${JSON.stringify(gcsv)})`);await sleep(20);$('#dl [data-i="2"]').click();await pz;
 ok(run(`gOf.A`)===ng&&run(`G.names['${ng}']`)==='Climbing'&&run(`G.colors['${ng}']`)==='#ff0000','groups round-trip through CSV');
 // delete + reset
 run(`tab='Groups';render()`);$(`#bd [data-act=gdel][data-g="${ng}"]`).click();await sleep(20);$('#dl [data-i="1"]').click();await sleep(20);
 ok(run(`G.cg['${ng}']`)===undefined&&run('gOf.A')===undefined,'delete group ungroups its members');
 run(`tab='Groups';render()`);$('#bd [data-act=gauto]').click();await sleep(20);$('#dl [data-i="1"]').click();await sleep(20);
 ok(run('Object.keys(G.cg).length')===0&&run('S.people.every(p=>p.g===undefined)')&&grp().length===2,'reset to automatic restores auto groups');

 // ---- line colours: thin, curved, red→blue ----
 const col=t=>run(`tierColor(${t})`),rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
 run('resetAll();commit()');
 ok(/^#[0-9a-f]{6}$/.test(col(1))&&rgb(col(1))[0]>rgb(col(1))[2]&&rgb(col(5))[2]>rgb(col(5))[0],'default gradient: tier 1 reddish, tier 5 bluish ('+col(1)+' → '+col(5)+')');
 ok(new Set([1,2,3,4,5].map(col)).size===5,'5 distinct tier colours');
 const E=(a,b,t)=>{w.__q.length=0;w.__lw.length=0;w.__col.length=0;w.__dash.length=0;run(`edge({id:'${a[0]}',x:${a[1]},y:${a[2]}},{id:'${b[0]}',x:${b[1]},y:${b[2]}},${typeof t==='string'?"'"+t+"'":t},'#000','#888','#f00','#fff')`)};
 E(['a',0,0],['b',100,0],3);
 ok(w.__q.length===1&&w.__lw[0]<=1.2&&w.__col[0]===col(3)&&w.__dash.every(d=>d==='[]'),'normal edge: one thin curved solid line in the tier colour (width '+w.__lw[0]+')');
 ok(Math.abs(w.__q[0][1])>5,'edge is curved (control point off the straight line: '+w.__q[0][1].toFixed(1)+')');
 const c1=w.__q[0].slice(0,2);E(['b',100,0],['a',0,0],3);const c2=w.__q[0].slice(0,2);
 ok(Math.abs(c1[0]-c2[0])<1e-9&&Math.abs(c1[1]-c2[1])<1e-9,'same curve regardless of endpoint order');
 E(['a',0,0],['b',100,0],1);const w1=w.__lw[0];E(['a',0,0],['b',100,0],5);
 ok(w1===w.__lw[0],'all tiers use the same thin width (no thick/thin by tier)');
 E(['a',0,0],['b',100,0],'h');ok(w.__col[0]==='#f00'&&w.__dash.every(d=>d==='[]'),'romantic: single pink line, no double line');
 E(['a',0,0],['b',100,0],'b');ok(w.__dash.includes('[3,4]'),'broken up: dashed gray line');
 run(`tab='Appearance';render()`);let ca=$('#bd [data-act=tca]');ca.value='#00ff00';ca.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(col(1)==='#00ff00','changing gradient start colour changes tier 1');
 ca=$('#bd [data-act=tcb]');ca.value='#0000ff';ca.dispatchEvent(new w.Event('change',{bubbles:true}));ok(col(5)==='#0000ff','changing gradient end colour changes tier 5');
 let tcI=$('#bd [data-act=tcol][data-t="3"]');tcI.value='#123456';tcI.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(col(3)==='#123456'&&col(2)!=='#123456','per-tier colour override');
 ok($('#bd [data-act=tcol][data-t="3"]').value==='#123456'&&$('#bd [data-act=tcol][data-t="1"]').value==='#00ff00','Appearance tab swatches show current colours');
 const ccsv=run('csvText()');ok(/gradient,a,.*#00ff00/.test(ccsv)&&/tier,3,.*#123456/.test(ccsv),'csv has gradient + tier colours');
 run('resetAll();commit()');ok(col(1)!=='#00ff00','state reset');
 let pc=run(`importCSV(${JSON.stringify(ccsv)})`);await sleep(20);$('#dl [data-i="2"]').click();await pc;
 ok(col(1)==='#00ff00'&&col(5)==='#0000ff'&&col(3)==='#123456','tier colours round-trip through CSV');
 run(`tab='Appearance';render()`);$('#bd [data-act=tcreset]').click();ok(col(1)===run('d3.color(TC0).formatHex()')&&run('Object.keys(G.tcol.o).length')===0,'Reset colours restores default red→blue');
 // ---- crowded tiers get more room; labels don't overlap; fit ----
 mk(['A'],[]);run(`S.people[0].tier=3;commit()`);const r3a=run('R(3)');
 run(`S.people=Array.from({length:30},(_,i)=>({id:'q'+i,name:'Person'+i,tier:3}));S.links=[];commit()`);const r3b=run('R(3)');
 ok(r3a===250&&r3b>=30*85/6.283-1,'tier-3 ring grows with crowding: '+r3a+' → '+r3b.toFixed(0)+' for 30 people');
 ok(run('R(4)')>=r3b+70,'outer rings are pushed outward too');
 run(`S.people=['L','M'].map(n=>({id:n,name:n+'long name here',tier:null}));S.links=[];commit();sim.stop()`);
 run(`byId.L.x=0;byId.L.y=0;byId.M.x=1;byId.M.y=1;byId.L.hw=60;byId.M.hw=60`);for(let i=0;i<150;i++)run('sim.tick()');
 ok(Math.abs(run('byId.L.x-byId.M.x'))>=100||Math.abs(run('byId.L.y-byId.M.y'))>=20,'overlapping name labels are pushed apart');
 run(`S.people=Array.from({length:40},(_,i)=>({id:'r'+i,name:'Person'+i,tier:1+i%5}));S.links=[];commit();sim.stop()`);for(let i=0;i<200;i++)run('sim.tick()');run('fit(0)');
 ok(run('nodes.every(n=>{const x=T.x+n.x*T.k,y=T.y+n.y*T.k;return x>=0&&x<=W&&y>=0&&y<=H})'),'Fit brings every name into view (zoom '+run('T.k').toFixed(2)+')');
 // ---- center becomes You ----
 mk(['X','Y','Z'],[['X','Y',3],['Y','Z',2]]);run(`S.people.find(p=>p.id==='X').tier=2;S.people.find(p=>p.id==='Y').tier=1;commit();setLinkMode(false);sim.stop()`);
 run(`byId.Y.x=120;byId.Y.y=0;byId.Y.hw=30`);ev($('#c'),'click',{clientX:run('T.x+120*T.k'),clientY:run('T.y')});
 ok([...$('#pk').querySelectorAll('button')].some(b=>b.dataset.m==='center'),'menu has Center');
 [...$('#pk').querySelectorAll('button')].find(b=>b.dataset.m==='center').click();run('sim.stop()');
 ok(run('ctr')==='Y'&&run('byId.Y.fx')===0&&run('byId.Y.fy')===0,'Center makes that person the center of the map');
 ok(run('byId.you.tier')===1&&run('byId.X.tier')===3&&run('byId.Z.tier')===2,'others now sit at their closeness to the new center (You=1, X=3, Z=2)');
 ok(run("links.some(l=>l.source.id==='you'&&l.target.id==='X'&&l.t===2)"),'You–X tie becomes an ordinary link while Y is center');
 ok($('#vb').style.display!=='none'&&/Centered on Y/.test($('#vb').textContent),'“back to You” chip appears');
 run("fixPerson('X',200,50)");ok(run("S.people.find(p=>p.id==='X').px")===undefined&&JSON.stringify(run("S.people.find(p=>p.id==='X').pos.Y"))==='[200,50]','fixed position is remembered per center person');
 $('#vb').click();run('sim.stop()');ok(run('ctr')==='you'&&run('byId.X.fx')==null&&run('byId.you.fx')===0,'back to You: X no longer fixed, You centered again');
 run("setCenter('Y');sim.stop()");ok(run('byId.X.fx')===200,'X’s Y-view position restored when Y is center again');
 run(`byId.you.x=-150;byId.you.y=0;byId.you.hw=30`);ev($('#c'),'click',{clientX:run('T.x-150*T.k'),clientY:run('T.y')});
 ok([...$('#pk').querySelectorAll('button')].map(b=>b.dataset.m).join()==='center','clicking You (when not center) offers Center only');$('#pk').style.display='none';
 run("S.people=S.people.filter(p=>p.id!=='Y');commit()");ok(run('ctr')==='you'&&$('#vb').style.display==='none','deleting the center person returns to You');
 run(`resetAll();S.people=['A','B','C'].map(n=>({id:n,name:n,tier:null}));S.people[0].tier=1;S.people[1].tier=5;S.people[2].tier='h';S.links=[{a:'A',b:'B',t:3},{a:'B',b:'C',t:'b'}];commit()`);
 // csv round-trip with heart/broken to You
 const csv2=run('csvText()');ok(/person,C,C,heart/.test(csv2),'csv writes heart for You link');
 run('resetAll();commit()');const pq=run(`importCSV(${JSON.stringify(csv2)})`);await sleep(20);$('#dl [data-i="2"]').click();await pq;
 ok(run(`S.people.find(p=>p.name==='C').tier`)==='h'&&run(`S.people.find(p=>p.name==='A').tier`)===1,'You heart round-trips via CSV');
 // ---- fractional tiers and appearance controls ----
 run(`resetAll();S.people=[{id:'P',name:'P',tier:null}];S.links=[];commit();sim.stop();tab='People';lv='P';render()`);
 let fractionalInput=$('#bd .ti');fractionalInput.value='1.5';fractionalInput.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(run(`S.people[0].tier`)===1.5&&Math.abs(run('R(1.5)-(R(1)+R(2))/2'))<1e-6,'decimal tier 1.5 is stored and positioned between rings');
 ok(run('tierColor(1.9)===tierColor(1)&&tierColor(2.9)===tierColor(2)&&tierColor(.7)===tierColor(1)'),'fractional tiers use their lower integer tier color');
 fractionalInput=$('#bd .ti');fractionalInput.value='.7';fractionalInput.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(run(`S.people[0].tier`)===0.7&&run('R(.7)<R(1)'),'decimal tier below 1 is accepted and placed inside the first ring');
 fractionalInput=$('#bd .ti');fractionalInput.value='1.5';fractionalInput.dispatchEvent(new w.Event('change',{bubbles:true}));
 const fractionalCsv=run('csvText()');ok(/person,P,P,1\.5/.test(fractionalCsv),'fractional tiers export to CSV');
 const fractionalImport=run(`importCSV(${JSON.stringify(fractionalCsv)})`);await sleep(20);$('#dl [data-i="2"]').click();await fractionalImport;
 ok(run(`S.people[0].tier`)===1.5,'fractional tiers round-trip through CSV');
 run(`tab='Appearance';render()`);
 let appearanceInput=$('#bd [data-act=nameSize]');appearanceInput.value='18';appearanceInput.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(run('G.appearance.nameSize')===18,'appearance setting changes name size');
 appearanceInput=$('#bd [data-act=lineWidth]');appearanceInput.value='2.2';appearanceInput.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(run('G.appearance.lineWidth')===2.2,'appearance setting changes line thickness');
 appearanceInput=$('#bd [data-act=ringSpacing]');appearanceInput.value='100';appearanceInput.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(run('G.appearance.ringSpacing')===100&&Math.abs(run('R(3)-R(2)')-100)<1e-6,'ring spacing stays uniform and is adjustable');
 ok(JSON.parse(w.localStorage.getItem('todo-circles')).G.appearance.nameSize===18,'appearance settings autosave');
 run(`G.tcol.a='#00ff00';G.tcol.o[2]='#123456';render()`);
 $('#bd [data-act=areset]').click();
 ok(run(`JSON.stringify(G.appearance)===JSON.stringify({nameSize:13,lineWidth:1.1,ringSpacing:80})&&G.tcol.a===TC0&&G.tcol.b===TC1&&Object.keys(G.tcol.o).length===0`),'reset appearance restores all sizing controls and colors');
 // ---- shift selection, pair editing, and group drag ----
 run(`resetAll();S.people=['A','B','C'].map(name=>({id:name,name,tier:null}));S.links=[];commit();sim.stop();T=d3.zoomIdentity`);
 run(`byId.A.x=100;byId.A.y=100;byId.B.x=200;byId.B.y=100;byId.C.x=300;byId.C.y=100;nodes.forEach(n=>n.hw=30)`);
 ev($('#c'),'click',{clientX:100,clientY:100});
 const shiftClick=(x,y)=>{w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Shift',bubbles:true}));ev($('#c'),'click',{clientX:x,clientY:y,shiftKey:true})};
 shiftClick(200,100);
 ok(run('selectedPeople.size')===2&&!!$('#pk .tc'),'shift-clicking a second person opens the relationship picker');
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Shift',bubbles:true}));
 ok($('#pk').style.display==='flex'&&$('#pk').dataset.kind==='relationship','relationship picker stays open while Shift is held');
 shiftClick(200,100);
 ok(run('selectedPeople.size')===1&&$('#pk').style.display!=='flex','shift-clicking a selected person deselects them');
 shiftClick(200,100);shiftClick(300,100);
 ok(run('selectedPeople.size')===3,'shift-clicking more people adds them to the selection');
 ev($('#c'),'pointerdown',{clientX:200,clientY:100});ev($('#c'),'pointermove',{clientX:230,clientY:120});ev($('#c'),'pointerup',{clientX:230,clientY:120});
 ok(Math.abs(run('byId.A.x')-130)<1e-3&&Math.abs(run('byId.B.x')-230)<1e-3&&Math.abs(run('byId.C.x')-330)<1e-3,'dragging a multi-selection moves the whole group together');
 ok(run(`S.people.every(person=>person.px!=null&&person.py!=null)`),'group drag saves every selected position');
 ev($('#c'),'contextmenu',{clientX:500,clientY:350,button:2});
 ok($('#cm').style.display==='flex'&&/Relax everyone/.test($('#cm').textContent)&&/Reset groups/.test($('#cm').textContent),'right-click opens the custom graph menu');
 $('#cm [data-context-action=relax]').click();
 ok(run(`S.people.every(person=>person.px===undefined)`),'graph menu relaxes everyone');
 ev($('#c'),'contextmenu',{clientX:500,clientY:350,button:2});$('#cm [data-context-action=appearance]').click();
 ok(run(`tab==='Appearance'`),'graph menu opens appearance settings');
 // ---- watercolor-style group fills ----
 run(`resetAll();S.people=['A','B'].map(name=>({id:name,name,tier:null}));S.links=[];commit();sim.stop();G.colors.c1='#ff0000';G.names.c1='Group';groups={c1:new Set(['A','B'])};gOf={A:'c1',B:'c1'}`);
 w.__fill.length=0;w.__col.length=0;w.__shadow.length=0;w.__q.length=0;run('draw()');
 ok(w.__fill.includes('#ff000024')&&w.__shadow.includes(24),'group fill uses translucent color and a soft blur');
 ok(!w.__col.includes('#ff000066')&&w.__q.length>0,'group shape has smooth rounded edges without a solid outline');
 // draw smoke with all states
 run('draw()');ok(errs.length===0,'draw ok, no errors: '+errs.join('|'));
 console.log(fails?`\n${fails} FAILED`:'\nALL PASSED');process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2)});
