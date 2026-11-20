// Period-inspired designations for the two land counter types in the playtest.
const formationPools = {
  Germany: {
    inf: ['7. Infanterie-Division','12. Infanterie-Division','30. Infanterie-Division','44. Infanterie-Division','61. Infanterie-Division','71. Infanterie-Division'],
    tank: ['1. Panzer-Division','2. Panzer-Division','3. Panzer-Division','5. Panzer-Division','7. Panzer-Division','10. Panzer-Division']
  },
  France: {
    inf: ['1re Division d’infanterie motorisée','3e Division d’infanterie motorisée','9e Division d’infanterie motorisée','14e Division d’infanterie','25e Division d’infanterie motorisée','42e Division d’infanterie'],
    tank: ['1re Division cuirassée','2e Division cuirassée','3e Division cuirassée','4e Division cuirassée','1re Division légère mécanique','2e Division légère mécanique']
  },
  'United Kingdom': {
    inf: ['3rd Infantry Division','50th Northumbrian Division','51st Highland Division','53rd Welsh Division'],
    tank: ['1st Armoured Division','7th Armoured Division','4th Armoured Brigade','1st Army Tank Brigade']
  },
  'United States': {
    inf: ['1st Infantry Division','29th Infantry Division','36th Infantry Division','45th Infantry Division'],
    tank: ['1st Armored Division','2nd Armored Division','3rd Armored Division','4th Armored Division']
  },
  'Soviet Union': {
    inf: ['24th Rifle Division','100th Rifle Division','150th Rifle Division','172nd Rifle Division'],
    tank: ['4th Tank Brigade','6th Tank Division','11th Tank Division','20th Tank Brigade']
  },
  Italy: {
    inf: ['Divisione Granatieri di Sardegna','Divisione fanteria «Sassari»','Divisione fanteria «Pavia»','Divisione fanteria «Bologna»'],
    tank: ['Divisione corazzata «Ariete»','Divisione corazzata «Littorio»','Divisione corazzata «Centauro»']
  },
  Japan: {
    inf: ['2nd Sendai Division','5th Hiroshima Division','6th Kumamoto Division','9th Kanazawa Division'],
    tank: ['1st Tank Regiment','3rd Tank Regiment','4th Tank Regiment','7th Tank Regiment']
  },
  ANZAC: {
    inf: ['6th Australian Division','7th Australian Division','9th Australian Division','2nd New Zealand Division'],
    tank: ['1st Australian Armoured Division','2/4th Australian Armoured Regiment','4th New Zealand Armoured Brigade']
  },
  China: {
    inf: ['36th Division, National Revolutionary Army','87th Division, National Revolutionary Army','88th Division, National Revolutionary Army','New 38th Division']
  }
};

export function drawFormationNames(territories){
  const names={}, remaining=new Map();
  for(const [id,{name,owner}] of Object.entries(territories)){
    names[id]={};
    for(const [type,pool] of Object.entries(formationPools[owner]||{})){
      const key=owner+' '+type;
      if(!remaining.has(key))remaining.set(key,[...pool]);
      const choices=remaining.get(key);
      const index=Math.floor(Math.random()*(choices.length||pool.length));
      names[id][type]=choices.length?choices.splice(index,1)[0]:pool[index]+' ('+name+')';
    }
  }
  return names;
}
