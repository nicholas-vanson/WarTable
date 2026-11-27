// Run with Node.js 22 or later. Serves the game and its two-seat rooms on one LAN origin.
import http from 'node:http';
import {createHash} from 'node:crypto';
import {createReadStream,existsSync,mkdirSync,readFileSync,renameSync,statSync,writeFileSync} from 'node:fs';
import {homedir,networkInterfaces} from 'node:os';
import {dirname,extname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyLanCommand,createLanMatch,oppositeSide} from './lan-game.js';

const root=dirname(fileURLToPath(import.meta.url));
const data=process.env.WARTABLE_DATA_DIR||join(homedir(),'.wartable','rooms');
mkdirSync(data,{recursive:true,mode:0o700});
const jsonFile=p=>JSON.parse(readFileSync(p,'utf8'));
const setup=jsonFile(join(root,'assets/global-setup.json')),sectors=jsonFile(join(root,'assets/world-sectors.json'));
const version=readFileSync(join(root,'index.html'),'utf8').match(/application-version" content="([^"]+)/)[1];
const addresses=Object.values(networkInterfaces()).flat().filter(i=>i.family==='IPv4'&&!i.internal).map(i=>i.address);
const hosts=new Set(['localhost','127.0.0.1','[::1]',...addresses]);
const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json','.txt':'text/plain'};
const roomPath=code=>join(data,code+'.json');
const hash=token=>createHash('sha256').update(token).digest('hex');
function fail(status,message){throw Object.assign(new Error(message),{status});}
function send(res,status,body){
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(body===undefined?undefined:JSON.stringify(body));
}
function storeRoom(room){
  const p=roomPath(room.code);
  writeFileSync(p+'.tmp',JSON.stringify(room),{mode:0o600});renameSync(p+'.tmp',p);
}
function validJson(value,depth=0){
  if(depth>12)return false;
  if(value===null||typeof value==='boolean')return true;
  if(typeof value==='number')return Number.isSafeInteger(value);
  if(typeof value==='string')return value.length<=160&&!/[<>&"\\\x00-\x1f]/.test(value)&&!Object.hasOwn(Object.prototype,value)&&value!=='prototype';
  return typeof value==='object'&&Object.entries(value).every(([k,v])=>/^[a-zA-Z0-9_]+$/.test(k)&&!Object.hasOwn(Object.prototype,k)&&k!=='prototype'&&validJson(v,depth+1));
}
async function body(req){
  if(req.headers['content-type']?.split(';')[0]!=='application/json')fail(415,'Send a JSON game command.');
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>131072)fail(413,'This order is too large.');chunks.push(chunk);}
  let value;try{value=JSON.parse(Buffer.concat(chunks));}catch{fail(400,'Unreadable game command.');}
  if(!value||Array.isArray(value)||typeof value!=='object'||!validJson(value))fail(400,'Invalid game command.');
  return value;
}
function reply(room,seat){
  return {code:room.code,revision:room.revision,seat,side:seat===1?room.hostSide:oppositeSide(room.hostSide),
    hostSide:room.hostSide,joined:!!room.guest,research:room.research,match:room.match};
}
async function api(req,res,url){
  const read=req.method==='GET',path=url.pathname;
  if(read&&path==='/api/lan')return send(res,200,{service:'WarTable LAN',version});
  if(!read&&req.method!=='POST')fail(405,'Unsupported request.');
  const token=req.headers.authorization?.match(/^Bearer ([a-f0-9]{48})$/)?.[1];
  if(!token)fail(401,'Open the invitation or use the browser you joined with.');
  const digest=hash(token),args=read?{}:await body(req);
  // All disk reads, validation, rolls and the final rename below run in one event-loop turn.
  if(path==='/api/rooms'&&!read){
    if(!['Axis','Allies'].includes(args.side)||typeof args.research!=='boolean')fail(400,'Choose a side and research setting.');
    // A retried create from this browser receives the same room and seat.
    const code=digest.slice(0,10).toUpperCase();
    if(existsSync(roomPath(code))){
      const existing=jsonFile(roomPath(code));if(existing.host!==digest)fail(409,'Try creating a new room.');
      return send(res,200,reply(existing,1));
    }
    const room={code,host:digest,guest:null,hostSide:args.side,research:args.research,revision:1,match:null,last:{}};
    storeRoom(room);return send(res,201,reply(room,1));
  }
  const found=path.match(/^\/api\/rooms\/([A-F0-9]{10})(?:\/(join|start|action))?$/);
  if(!found||!existsSync(roomPath(found[1])))fail(404,'Room not found on this computer. Check the address and code.');
  const room=jsonFile(roomPath(found[1])),op=found[2];
  let seat=room.host===digest?1:room.guest===digest?2:0;
  if(!read&&op==='join'){
    if(!seat){
      if(room.guest||room.match)fail(409,'Both seats are taken. Reopen this room in the browser you joined with.');
      seat=2;room.guest=digest;room.revision++;storeRoom(room);
    }
    return send(res,200,reply(room,seat));
  }
  if(!seat)fail(403,'This browser does not hold a seat in this room.');
  if(read&&!op){
    if(url.searchParams.get('since')===String(room.revision))return send(res,204);
    return send(res,200,reply(room,seat));
  }
  if(read||!['start','action'].includes(op))fail(405,'Unsupported room request.');
  if(!/^[a-f0-9]{48}$/.test(args.id||''))fail(400,'Missing action identifier.');
  if(room.last[seat]===args.id)return send(res,200,reply(room,seat));
  if(args.revision!==room.revision)fail(409,'The board changed. Review the current position.');
  if(op==='start'){
    if(seat!==1||room.match||!room.guest)fail(409,'The host can start after both players join.');
    room.match=createLanMatch(setup,room.hostSide,room.research);
  }else{
    if(!room.match)fail(409,'The host must start the match.');
    try{room.match=applyLanCommand(room.match,setup,sectors,seat===1?room.hostSide:oppositeSide(room.hostSide),args.action,args.args);}
    catch(err){fail(422,err instanceof TypeError?'Invalid choice for this position.':err.message);}
  }
  room.last[seat]=args.id;room.revision++;storeRoom(room);send(res,200,reply(room,seat));
}
const port=Number(process.env.PORT||process.argv[2]||8080);
const server=http.createServer(async(req,res)=>{
  try{
    const origin='http://'+req.headers.host,url=new URL(req.url,origin);
    if(!hosts.has(new URL(origin).hostname)||req.headers.origin&&req.headers.origin!==origin)fail(403,'Use the address printed by the LAN host.');
    if(url.pathname.startsWith('/api/'))return await api(req,res,url);
    if(req.method!=='GET'&&req.method!=='HEAD')fail(405,'Unsupported request.');
    const name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
    if(!/^(?:[a-z0-9-]+\.(?:js|webmanifest|css)|index\.html|LICENSE\.txt|assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:webp|svg|png|json))$/.test(name))fail(404,'File not found.');
    const p=join(root,name);if(!existsSync(p)||!statSync(p).isFile())fail(404,'File not found.');
    res.writeHead(200,{'Content-Type':types[extname(p)],'Cache-Control':name.startsWith('assets/')?'public, max-age=86400':'no-cache'});
    if(req.method==='HEAD')return res.end();
    const stream=createReadStream(p);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  }catch(err){if(!res.headersSent)send(res,err.status||500,{error:err.status?err.message:'The host could not save or serve this request.'});}
});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?'That port is already in use. Try node lan-server.mjs 8081.':err.message);process.exitCode=1;});
server.listen(port,'0.0.0.0',()=>{
  console.log('WarTable '+version+' · Keep this computer awake and this window open.');
  for(const address of addresses)console.log('Open on both phones: http://'+address+':'+server.address().port+'/#multiplayer');
  console.log('On this computer: http://localhost:'+server.address().port+'/#multiplayer');
  console.log('Saved rooms: '+data);
});
