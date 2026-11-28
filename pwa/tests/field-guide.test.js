import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startGlobalPlaytest,globalPowers} from '../global-game.js';
import {nationalObjectiveAccounts,openIncome} from '../income.js';
import {objectivesReference,objectiveMapInfo,politicsReference} from '../field-guide.js';
import {declareWar} from '../politics.js';

const setup=JSON.parse(readFileSync(new URL('../assets/global-setup.json',import.meta.url)));
const players=Object.fromEntries(Object.keys(globalPowers).map(p=>[p,1]));
const opening=()=>startGlobalPlaytest(setup,players);

test('every off-turn forecast matches the actual income objective lines without changing the board',()=>{
  const m=opening();
  m.board.Kwangtung.owner='Japanese';
  m.board.Novgorod.owner='Germans';
  m.board.Norway.owner='British';
  m.board.Yunnan.owner='Japanese';
  const pair=m.diplomacy.find(([a,b])=>[a,b].includes('Germans')&&[a,b].includes('Russians'));
  pair[2]='War';
  const before=structuredClone(m);
  for(const power of Object.keys(globalPowers)){
    const accounts=nationalObjectiveAccounts(m,power);
    const turn=structuredClone(m);
    turn.power=power;turn.phase='mobilize';turn.combat={game:{power,phase:'mobilize',battles:[],record:[]}};
    const actual=openIncome(turn).incomeReport.accounts;
    assert.deepEqual(accounts.map(a=>[a.wallet,a.bonus]),actual.map(a=>[a.wallet,a.bonus]));
    for(const [i,a] of accounts.entries()){
      assert.deepEqual(a.objectives.map(o=>[o.label,o.earned]),actual[i].objectives.map(o=>[o.label,o.earned]));
    }
    assert.ok(objectivesReference(m,power));assert.ok(politicsReference(m,power));
  }
  assert.deepEqual(m,before);
  assert.match(objectivesReference(m,'Germans'),/German control of Norway/);
  assert.match(objectivesReference(m,'Chinese'),/Outside qualifying control · Yunnan/);
  assert.match(objectivesReference(m,'Germans'),/Qualifying territories: Novgorod/);
});

test('regional capital loss, war requirements and the one-time liberation award have distinct states',()=>{
  const m=opening();m.board['United Kingdom'].owner='Germans';
  let accounts=nationalObjectiveAccounts(m,'British');
  assert.equal(accounts[0].open,false);assert.equal(accounts[0].bonus,0);
  assert.equal(accounts[1].open,true);assert.equal(accounts[1].objectives[0].warNeeded,true);
  assert.match(objectivesReference(m,'British'),/Recover the capital territory \(United Kingdom\)/);
  const japan=m.diplomacy.find(([a,b])=>[a,b].includes('British')&&[a,b].includes('Japanese'));japan[2]='War';
  accounts=nationalObjectiveAccounts(m,'British');assert.equal(accounts[1].bonus,5);
  assert.match(objectivesReference(m,'French'),/Available on first liberation/);
  m.combat={game:{frenchAward:{status:'pending'}}};assert.match(objectivesReference(m,'French'),/Ready to place/);
  m.frenchLiberationAwarded=true;m.combat=null;assert.match(objectivesReference(m,'French'),/Already awarded/);
});

test('declaration guidance follows the real turn, existing orders, linked powers and US income decision',()=>{
  const m=opening();m.power='Japanese';m.phase='combatMove';m.combat={game:{phase:'plan',orders:[],record:[]}};
  const jp=politicsReference(m,'Japanese');
  assert.match(jp,/May declare on the United Kingdom and ANZAC/);
  assert.doesNotMatch(politicsReference(m,'Americans'),/May declare on/);
  const next=declareWar(m,['British']);assert.match(politicsReference(next,'Japanese'),/ANZAC<\/strong><span class="at-war"/);
  assert.doesNotMatch(politicsReference(next,'Japanese'),/May declare on the United Kingdom/);
  m.combat.game.rocketOrders=[{}];assert.doesNotMatch(politicsReference(m,'Japanese'),/May declare on/);
  m.power='Americans';m.phase='income';m.round=3;
  assert.match(politicsReference(m,'Americans'),/round 3 U.S. decision is open/);
  assert.match(politicsReference(m,'Americans'),/May declare on Germany/);
  m.incomeReport={stayedAtPeace:true};assert.doesNotMatch(politicsReference(m,'Americans'),/May declare on/);
});

test('objective maps identify the qualifying places independently of political and income gates',()=>{
  const m=opening();
  const info=(power,label,wallet=power)=>objectiveMapInfo(m,power,wallet,label);
  const status=row=>Object.fromEntries(row.sites.map(({name,met})=>[name,met]));
  assert.equal(info('Germans','Soviet trade'),null);
  for(const power of Object.keys(globalPowers))for(const a of nationalObjectiveAccounts(m,power)){
    for(const o of a.objectives){
      if(o.label==='Soviet trade')continue;
      const row=info(power,o.label,a.wallet);
      assert.ok(row.sites.length,o.label);
      assert.equal(row.sites.length,new Set(row.sites.map(site=>site.name)).size);
      for(const site of row.sites){assert.ok(m.board[site.name],site.name);assert.equal(typeof site.met,'boolean');}
    }
  }
  m.board.Norway.owner='British';
  assert.deepEqual(status(info('Germans','Swedish iron ore')),{Denmark:true,Norway:false,Sweden:true});
  assert.equal(info('Germans','Swedish iron ore').bonus,'0 IPCs projected');
  assert.deepEqual(status(info('British','Far East trade','UK_Pacific')),{Kwangtung:true,Malaya:true});
  assert.equal(info('British','Far East trade','UK_Pacific').bonus,'0 IPCs projected');
  m.board['125 Sea Zone'].units=[['Germans','destroyer',1]];
  m.board.Archangel.units.push(['British','infantry',1]);
  const arctic=status(info('Russians','Arctic lend-lease'));
  assert.equal(arctic.Archangel,false);assert.equal(arctic['125 Sea Zone'],false);
  m.board.Archangel.units.pop();assert.equal(status(info('Russians','Arctic lend-lease')).Archangel,true);
  m.board['93 Sea Zone'].units=[['British','submarine',1]];
  assert.equal(status(info('Italians','Mediterranean sea lanes'))['93 Sea Zone'],true);
  m.board['93 Sea Zone'].units.push(['British','cruiser',1]);
  assert.equal(status(info('Italians','Mediterranean sea lanes'))['93 Sea Zone'],false);
  m.board.France.owner='Germans';
  assert.equal(status(info('French','Liberation of Paris')).France,false);
  assert.equal(info('French','Liberation of Paris').bonus,'Up to 12 IPCs in units');
});
