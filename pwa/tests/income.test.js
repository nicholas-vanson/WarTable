import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startGlobalPlaytest,globalPowers} from '../global-game.js';
import {openIncome,collectIncome,rollConvoys,incomeAmount} from '../income.js';
const setup=JSON.parse(readFileSync(new URL('../assets/global-setup.json',import.meta.url)));
const controllers=Object.fromEntries(Object.keys(globalPowers).map(p=>[p,1]));
function opening(power='Germans',edit=()=>{}){
  const m=startGlobalPlaytest(setup,controllers);m.power=power;
  m.diplomacy=structuredClone(m.diplomacy);m.phase='mobilize';
  m.combat={game:{power,phase:'mobilize',battles:[],record:[],pieces:{}}};
  edit(m);return openIncome(m);
}
function war(m,p){
  const pair=m.diplomacy.find(([a,b])=>a===m.power&&b===p||b===m.power&&a===p);
  pair[2]='War';
}
const account=m=>m.incomeReport.accounts[0];
test('opening income separates land, named bonuses and treasury for each power',()=>{
  const expected={Germans:[[30,10]],Russians:[[37,0]],Japanese:[[26,10]],Americans:[[52,0]],Chinese:[[12,6]],British:[[28,5],[17,0]],Italians:[[10,0]],ANZAC:[[10,0]],French:[[19,0]]};
  for(const [power,amounts] of Object.entries(expected)){
    const m=opening(power);assert.deepEqual(m.incomeReport.accounts.map(a=>[a.land,a.bonus]),amounts,power);
    for(const a of m.incomeReport.accounts){
      assert.equal(a.land,a.territories.reduce((n,t)=>n+t.value,0));
      assert.equal(a.bonus,a.objectives.reduce((n,o)=>n+o.earned,0));
    }
  }
  const m=opening(),report=structuredClone(m.incomeReport),next=collectIncome(m);
  assert.equal(next.treasury.Germans,70);assert.equal(next.power,'Russians');assert.equal(next.phase,'briefing');
  assert.deepEqual(m.incomeReport,report);assert.deepEqual(next.turnReviews[0].record.at(-1).income,report);
  assert.throws(()=>collectIncome(next));assert.throws(()=>openIncome(m));
});
test('captured territory, broken trade, occupied capitals and independent regional treasuries',()=>{
  const m=opening('Germans',m=>{m.board.France.owner='Germans';m.board.Norway.owner='British';});
  assert.equal(account(m).land,31);assert.equal(account(m).bonus,5);assert(account(m).territories.some(t=>t.name==='France'&&t.value===4));
  const uk=opening('British',m=>{m.board['United Kingdom'].owner='Germans';war(m,'Japanese');});
  const [london,india]=uk.incomeReport.accounts;
  assert(!london.open);assert.equal(incomeAmount(london),0);assert.deepEqual(london.convoys,[]);
  assert.equal(india.before,17);assert.equal(india.bonus,5);assert(india.territories.some(t=>t.name==='West India'));
  const after=collectIncome(uk.incomeReport.rolled?uk:rollConvoys(uk,()=>.99));assert.equal(after.treasury.British,28);assert.equal(after.treasury.UK_Pacific,39);
  assert.equal(account(opening('French',m=>m.board.France.owner='Germans')).land,0);
});
test('convoy rolls survive reload, cap overlapping coasts and never consume bonus or another wallet',()=>{
  const m=opening('Japanese',m=>{
    for(const a of Object.values(m.board))if(a.coasts)a.units=[];
    war(m,'Americans');
    for(const a of Object.values(m.board))if(a.owner==='Japanese'&&a!==m.board.Japan)a.owner='Neutral_True';
    for(const z of ['6 Sea Zone','19 Sea Zone'])m.board[z].units=[['Americans','submarine',3]];
  });
  assert(!m.incomeReport.rolled);assert.throws(()=>collectIncome(m));const old=m.treasury.Japanese;
  const rolled=rollConvoys(m,()=>.4),a=account(rolled);assert.equal(a.loss,8);assert.equal(a.land,8);
  assert(a.convoys.every(c=>c.rolled===18));assert.equal(a.convoys.reduce((n,c)=>n+(c.charges.Japan||0),0),8);
  const loaded=JSON.parse(JSON.stringify(rolled));assert.throws(()=>rollConvoys(loaded));
  assert.equal(collectIncome(loaded).treasury.Japanese,old);assert.equal(account(m).loss,0);
});
test('only eligible ships and carrier aircraft roll, high faces miss, and the receipt explains the charges',()=>{
  const m=opening('British',m=>{
    for(const a of Object.values(m.board))if(a.coasts)a.units=[];
    m.board['109 Sea Zone'].units=[['Germans','carrier',1],['Germans','fighter',1],['Germans','destroyer',1],['Germans','submarine',1],['Germans','transport',2],['Americans','cruiser',3]];
    m.board['106 Sea Zone'].units=[['Germans','transport',1]];
  });
  let i=0;const faces=[1,4,2,5,3];
  const a=account(rollConvoys(m,()=>(faces[i++]-.5)/6)),r=a.convoys[0];
  assert.equal(a.convoys.length,1);assert.equal(r.zone,109);assert.equal(i,5);assert.equal(r.rolled,6);
  assert.deepEqual(r.dice.map(g=>g.rolls),[[1,4],[2],[5,3]]);assert.equal(r.loss,6);
  assert.equal(Object.values(r.charges).reduce((n,v)=>n+v,0),6);
});
test('Burma Road, Soviet Berlin one-time payment and Japanese treaty history',()=>{
  assert.equal(account(opening('Chinese',m=>{m.board.Burma.owner='Japanese';})).bonus,0);
  const soviet=paid=>opening('Russians',m=>{war(m,'Germans');m.board.Germany.owner='Russians';m.berlinBonusPaid=paid;});
  const m=soviet(false);assert.equal(account(m).objectives.find(o=>o.key==='berlin').earned,10);
  assert(collectIncome(m.incomeReport.rolled?m:rollConvoys(m,()=>.8)).berlinBonusPaid);assert.equal(account(soviet(true)).objectives.find(o=>o.key==='berlin').earned,0);
  const japan=opening('Japanese',m=>{m.turnReviews=[{power:'Japanese',record:[{title:'Yunnan → French Indo China'}]}];});
  assert.equal(account(japan).bonus,0);
});
test('U.S. wartime income uses the current diplomatic state and territorial control',()=>{
  const us=opening('Americans',m=>{m.round=3;});assert.equal(account(us).bonus,0);
  const warred=opening('Americans',m=>{war(m,'Japanese');m.board.Philippines.owner='Japanese';});
  assert.equal(account(warred).bonus,20);
});
test('only aircraft with room on an operational friendly carrier disrupt convoys',()=>{
  const raid=damage=>opening('British',m=>{
    for(const a of Object.values(m.board))if(a.coasts)a.units=[];
    const zone=m.board['109 Sea Zone'];
    zone.units=[['Germans','carrier',1],['Italians','fighter',1],['Germans','tactical_bomber',2]];
    zone.shipDamage={Germans:{carrier:damage}};
  });
  assert.deepEqual(account(raid(0)).convoys[0].dice.map(g=>[g.type,g.number]),[['fighter',2],['tactical_bomber',2]]);
  assert.deepEqual(account(raid(1)).convoys,[]);
});
test('overlapping convoys can use another eligible coast when one is already charged',()=>{
  const m=opening('Japanese',m=>{
    war(m,'Americans');
    for(const a of Object.values(m.board))if(a.coasts)a.units=[];
    for(const [zone,coasts] of [[6,['Japan','Korea']],[19,['Japan']]]){
      const area=m.board[zone+' Sea Zone'];area.units=[['Americans','submarine',2]];area.coasts=coasts;
    }
  });
  const a=account(rollConvoys(m,()=>.4));
  assert.equal(a.loss,11);assert.equal(a.convoys[0].charges.Korea,3);
  assert.equal((a.convoys[0].charges.Japan||0)+(a.convoys[1].charges.Japan||0),8);
});
