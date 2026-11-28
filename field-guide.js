// Read-only projections of the position on the Global 1940 board.
import {nationalObjectiveAccounts} from './income.js';
import {politicalPowers,atWarWith,countryInSentence,declarationWindowOpen,declarationTargets,declarationDetails,usIncomeChoice} from './politics.js';
import {allianceOf} from './neutral-rules.js';

export function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function mapButton(row,wallet){
  return row.sites?.length?'<button type="button" class="objective-map-button" data-objective="'+esc(row.label)+'" data-wallet="'+esc(wallet)+'">Show on map</button>':'';
}
function parisAward(match){
  const award=match.combat?.game?.frenchAward?.status;
  const status=award==='pending'?'Ready to place':award==='placed'||match.frenchLiberationAwarded?'Already awarded':'Available on first liberation';
  return {label:'Liberation of Paris',status,condition:'The first time Paris is liberated, France may immediately place up to 12 IPCs of free land or air units in France.',
    sites:[{name:'France',met:match.board.France.owner==='French'}]};
}
export function objectiveMapInfo(match,power,wallet,label){
  if(power==='French'&&wallet==='French'&&label==='Liberation of Paris'){
    const row=parisAward(match);
    return {...row,bonus:'Up to 12 IPCs in units',legend:['French control','Outside French control']};
  }
  const a=nationalObjectiveAccounts(match,power).find(account=>account.wallet===wallet);
  const row=a?.objectives.find(o=>o.label===label);
  if(!row?.sites?.length)return null;
  const forecast=a.open?row.earned:0;
  const status=!a.open?'Treasury closed':row.warNeeded?'War requirement unmet':row.outstanding?.length?'Still needed · '+row.outstanding.join(' · '):'';
  return {...row,status,projected:forecast,bonus:forecast+' IPCs projected',legend:['Condition met','Condition unmet']};
}

function objectiveEntry(row,open,wallet){
  const status=!open?'Treasury closed':row.earned?'Met':'Unmet';
  const amount=row.perTerritory?row.value+' IPCs each':row.value+' IPCs';
  const balance=open&&row.earned?'+'+row.earned+' IPCs':amount;
  const progress=row.progress?'<p class="guide-progress">'+esc(row.progress)+'</p>':'';
  const missing=row.missing?.length?'<p>Outside qualifying control · '+esc(row.missing.join(', '))+'</p>':'';
  const outstanding=row.warNeeded?'<p>War requirement still unmet.</p>':row.outstanding?.length?
    '<p>Still needed · '+esc(row.outstanding.join(' · '))+'</p>':'';
  return '<details class="guide-objective"><summary><span><strong>'+esc(row.label)+'</strong>'+
    '<small class="guide-state'+(open&&row.earned?' earned':'')+'">'+status+'</small></span>'+
    '<span class="guide-amount">'+balance+'</span></summary><div class="guide-condition"><p>'+
    esc(row.condition)+'</p>'+progress+missing+outstanding+mapButton(row,wallet)+'</div></details>';
}

export function objectivesReference(match,power){
  const accounts=nationalObjectiveAccounts(match,power),split=accounts.length>1;
  const bonus=accounts.reduce((sum,a)=>sum+a.bonus,0);
  let html='<div class="guide-total"><div><h3>National objectives</h3><p>Projected bonus at Collect Income</p></div>'+
    '<strong>+'+bonus+' <small>IPCs</small></strong></div>';
  for(const a of accounts){
    if(split)html+='<h4 class="guide-wallet">'+(a.wallet==='British'?'UK Europe':'UK Pacific')+' <span>+'+a.bonus+' IPCs</span></h4>';
    if(!a.open)html+='<p class="guide-note">Treasury closed. Recover the capital territory ('+esc(a.capital)+') to collect income here.</p>';
    html+=a.objectives.map(row=>objectiveEntry(row,a.open,a.wallet)).join('');
  }
  if(power==='French'){
    const row=parisAward(match);
    html+='<p>France has no recurring national objective income.</p><h4 class="guide-wallet">'+row.label+'</h4>'+
      '<p class="guide-progress">'+row.status+'</p><p>'+row.condition+'</p>'+mapButton(row,'French');
  }
  return html;
}

const declarationRules={
  Germans:'Germany may declare war on the Soviet Union, the United States or China. Going to war with the Soviet Union ends the Soviet trade bonus.',
  Italians:'Italy may declare war on the Soviet Union, the United States or China.',
  Japanese:'Japan may declare war on the Soviet Union, France, the United States or the United Kingdom. A declaration against the United Kingdom also brings ANZAC into the war and allows attacks on Dutch territories.',
  Russians:'The Soviet Union may declare war on Japan independently. It may declare war on Germany or Italy from round 4, or earlier if the Axis has taken London or the Soviet Union is already at war with a European Axis power.',
  Americans:'If still at peace, the United States may declare war during Collect Income in round 3, then at the opening of Combat Move from round 4. Earlier entry is possible if an Axis power is already at war with the United States, Japan declares unprovoked war on the United Kingdom or ANZAC, or the Axis captures London or a qualifying North American territory.',
  Chinese:'China begins at war with Japan. China may declare war on Germany or Italy if that power has entered an original Chinese territory, Burma or Kwangtung.',
  British:'The United Kingdom may declare war on Japan. The UK Europe and UK Pacific economies share one political position. ANZAC also enters the war when the United Kingdom declares against Japan.',
  ANZAC:'ANZAC may declare war on Japan. A declaration by either ANZAC or the United Kingdom brings both into the war against Japan.',
  French:'France may declare war on Japan independently of the United Kingdom and ANZAC.'
};

export function politicsReference(match,power){
  const opposing=Object.keys(politicalPowers).filter(p=>allianceOf(p)!==allianceOf(power));
  const active=match.power===power,targets=active?declarationTargets(match):[];
  const current=active&&declarationWindowOpen(match);
  let timing;
  if(match.phase==='victory')timing='The game has ended.';
  else if(!active)timing='It is '+countryInSentence(match.power)+'’s turn. This power can issue declarations only on its own turn.';
  else if(usIncomeChoice(match))timing='The round 3 U.S. decision is open. Choose whether to enter the war before collecting income.';
  else if(match.phase==='income'&&power==='Americans'&&match.incomeReport?.stayedAtPeace)timing='The United States chose to remain at peace this income phase.';
  else if(current)timing=targets.length?'The declaration window is open. Use Declare war in Combat Move to review the consequences and confirm.':'The declaration window is open. No opposing power is eligible for a new declaration.';
  else if(match.phase==='combatMove')timing='Orders are already queued. The Combat Move declaration window is closed.';
  else timing='Declarations normally open at the start of Combat Move, before orders are queued.';
  let html='<h3 class="guide-heading">Political situation</h3><ul class="guide-relations">'+opposing.map(p=>{
    const war=atWarWith(match,power,p);
    return '<li><strong>'+politicalPowers[p]+'</strong><span class="'+(war?'at-war':'at-peace')+'">'+(war?'At war':'At peace')+'</span></li>';
  }).join('')+'</ul><h4 class="guide-wallet">Declarations</h4><p>'+esc(timing)+'</p>';
  for(const t of targets){
    const d=declarationDetails(match,[t]);
    html+='<details class="guide-declaration"><summary>May declare on '+esc(d.names)+'</summary><p>'+
      esc(d.effects.join(' ')||'The declaration takes effect immediately when confirmed.')+'</p></details>';
  }
  return html+'<p class="guide-note">'+esc(declarationRules[power])+'</p>';
}
