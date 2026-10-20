const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const dgram = require('node:dgram');
const http = require('node:http');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const work = path.resolve('.meow-config-check');
const exe = 'C:/Users/thesi/Documents/Codex/2026-10-20/c-users-thesi-downloads-mihomoscript-js/work/meow-alpha/meow-alpha-801ada1-x86_64-pc-windows-msvc/meow.exe';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const peers = new Set();
const proxyTargets = [];
let payload;
let child;

function dnsEnd(query) {let at = 12; while(query[at]) at += query[at] + 1; return at + 5;}
function dnsResponse(query) {
  const header = Buffer.from(query.subarray(0, 12));
  header.writeUInt16BE(0x8180, 2); header.writeUInt16BE(1, 6); header.writeUInt16BE(0, 8); header.writeUInt16BE(0, 10);
  return Buffer.concat([header, query.subarray(12, dnsEnd(query)), Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4, 127, 0, 0, 1])]);
}
const dns = dgram.createSocket('udp4');
dns.on('message', (query, remote) => dns.send(dnsResponse(query), remote.port, remote.address));
const target = http.createServer((request, response) => response.end('DIRECT'));
const provider = http.createServer((request, response) => {response.setHeader('Content-Type','application/yaml'); response.end(JSON.stringify({proxies:payload}));});
const socks = net.createServer(socket => {
  peers.add(socket); socket.on('close', () => peers.delete(socket)); socket.on('error',()=>{});
  let state = 'hello', buffer = Buffer.alloc(0);
  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      if (state === 'hello') {
        if (buffer.length < 2 || buffer.length < 2 + buffer[1]) return;
        buffer = buffer.subarray(2 + buffer[1]); socket.write(Buffer.from([5,0])); state = 'connect';
      } else if (state === 'connect') {
        if (buffer.length < 5) return;
        let end, host;
        if (buffer[3]===1) {end=8; host=[...buffer.subarray(4,8)].join('.');}
        else if (buffer[3]===3) {end=5+buffer[4]; if(buffer.length<end+2)return; host=buffer.subarray(5,end).toString();}
        else {socket.destroy(); return;}
        if(buffer.length<end+2)return;
        const port=buffer.readUInt16BE(end); buffer=buffer.subarray(end+2);
        proxyTargets.push({host,port});
        socket.write(Buffer.from([5,0,0,1,127,0,0,1,0,0])); state=port===53?'dns':'http';
      } else if (state === 'dns') {
        if(buffer.length<2 || buffer.length<2+buffer.readUInt16BE(0))return;
        const length=buffer.readUInt16BE(0), reply=dnsResponse(buffer.subarray(2,length+2));
        buffer=buffer.subarray(length+2); const prefix=Buffer.alloc(2); prefix.writeUInt16BE(reply.length);
        socket.write(Buffer.concat([prefix,reply]));
      } else {
        if(!buffer.includes('\r\n\r\n'))return;
        socket.end('HTTP/1.1 200 OK\r\nContent-Length: 5\r\nConnection: close\r\n\r\nPROXY'); return;
      }
    }
  });
});
async function listen(server) {server.listen(0,'127.0.0.1'); await once(server,'listening'); return server.address().port;}
async function tcpPort() {const server=net.createServer();const port=await listen(server);await new Promise(resolve=>server.close(resolve));return port;}
async function udpPort() {const socket=dgram.createSocket('udp4');socket.bind(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));return port;}
async function request(port, route, method='GET', body) {
  return new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port,path:route,method,timeout:5000,headers:body?{'Content-Type':'application/json'}:{}},res=>{
      let data='';res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode,data}));
    });
    req.on('timeout',()=>req.destroy(new Error('HTTP timeout '+route)));req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
  });
}
async function json(port,route) {const res=await request(port,route);assert.equal(res.status,200,route+':'+res.data);return JSON.parse(res.data);}
const testNames=['香港 01','日本 JP 01','美国 US 01','新加坡 0.5x','台湾 2x','德国 DE 01','免费 Free 01','剩余流量 100GB','Hong Kong 02','node JP 02','node US 02','abcHKdef','德国 x10','德国 3.0x','软件下载 01','德国下载 01'];
function nodes(names,port){return names.map(name=>({name,type:'socks5',server:'127.0.0.1',port}));}
async function stopChild(){if(child && child.exitCode===null){child.kill();await once(child,'exit');}child=undefined;}

(async()=>{
  const results=[];
  try {
    dns.bind(0,'127.0.0.1');await once(dns,'listening');
    const dnsAddress='127.0.0.1:'+dns.address().port;
    const targetPort=await listen(target), providerPort=await listen(provider), socksPort=await listen(socks);
    for(const variant of ['full','lite']) {
      const home=path.join(work,variant), config=JSON.parse(fs.readFileSync(path.join(work,variant+'.json'),'utf8'));
      payload=nodes(testNames,socksPort);
      const apiPort=await tcpPort(), mixedPort=await tcpPort();
      config.tun={enable:false};config['allow-lan']=false;config['bind-address']='127.0.0.1';config['mixed-port']=mixedPort;
      config['external-controller']='127.0.0.1:'+apiPort;config.strict=true;config.logbook={enable:false};
      config.dns.listen='127.0.0.1:'+await udpPort();config.dns['store-fake-ip']=false;
      config.dns['default-nameserver']=[dnsAddress];config.dns['proxy-server-nameserver']=[dnsAddress];
      for(const key of Object.keys(config.dns['nameserver-policy'])) config.dns['nameserver-policy'][key]=[dnsAddress];
      config.dns['fake-ip-filter'].push('foreign-smoke.test');
      config['proxy-providers'].provider1.type='http';config['proxy-providers'].provider1.url='http://127.0.0.1:'+providerPort+'/subscription';
      config['proxy-providers'].provider1.path='./runtime-provider.yaml';
      config['proxy-providers'].provider1['health-check'].url='http://127.0.0.1:'+targetPort+'/health';
      for(const p of Object.values(config['rule-providers'])) {p.type='file';delete p.url;delete p.interval;delete p.proxy;}
      for(const g of config['proxy-groups']) if(g.url) g.url='http://127.0.0.1:'+targetPort+'/health';
      fs.writeFileSync(path.join(home,'runtime.json'),JSON.stringify(config));
      let log='';child=spawn(exe,['-f',path.join(home,'runtime.json'),'-d',home],{windowsHide:true,stdio:['ignore','pipe','pipe']});
      child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);
      child.on('exit',()=>fs.writeFileSync(path.join(home,'runtime.log'),log));
      let version;
      for(let i=0;i<100;i++){
        if(child.exitCode!==null)throw Error('Core exited '+log);
        try {version=await json(apiPort,'/version');break;}catch{await pause(100);}
      }
      assert.ok(version,'Core API startup '+log);
      let proxies=(await json(apiPort,'/proxies')).proxies;
      assert.ok(proxies['手动选择'].all.includes('香港 01'));
      assert.ok(!proxies['手动选择'].all.includes('剩余流量 100GB'));
      assert.ok(proxies['香港-自动选择'].all.includes('Hong Kong 02'));
      assert.ok(!proxies['香港-自动选择'].all.includes('abcHKdef'));
      assert.ok(proxies['日本-自动选择'].all.includes('node JP 02'));
      assert.ok(proxies['美国-自动选择'].all.includes('node US 02'));
      for(const name of ['德国 x10','德国 3.0x','台湾 2x'])assert.ok(proxies['高倍率节点-自动选择'].all.includes(name),'high '+name);
      for(const name of ['新加坡 0.5x','免费 Free 01','德国下载 01'])assert.ok(proxies['低倍率节点-自动选择'].all.includes(name),'low '+name);
      assert.ok(!proxies['低倍率节点-自动选择'].all.includes('软件下载 01'));
      assert.equal(proxies.AI.now,'美国');if(variant==='full'){assert.equal(proxies.FCM.now,'直连');assert.equal(proxies.TikTok.now,'日本');}
      assert.deepEqual(proxies['直连'].all,['DIRECT']);
      const rules=(await json(apiPort,'/rules')).rules;
      assert.ok(rules.findIndex(r=>r.payload==='hdslb.com')<rules.findIndex(r=>r.payload==='cn_ip'));
      const domestic=await request(mixedPort,'http://s1.hdslb.com:'+targetPort+'/media');
      assert.equal(domestic.status,200,domestic.data);assert.equal(domestic.data,'DIRECT');
      const foreign=await request(mixedPort,'http://foreign-smoke.test:'+targetPort+'/foreign');
      assert.equal(foreign.status,200,foreign.data);assert.equal(foreign.data,'PROXY');
      payload=nodes(['日本 JP Updated','德国 DE Updated'],socksPort);
      assert.equal((await request(apiPort,'/providers/proxies/provider1','PUT')).status,204);
      proxies=(await json(apiPort,'/proxies')).proxies;
      assert.ok(proxies['日本-自动选择'].all.includes('日本 JP Updated'));
      assert.ok(!proxies['手动选择'].all.includes('香港 01'));
      assert.deepEqual(proxies['香港-自动选择'].all,[]);
      assert.equal((await request(apiPort,'/proxies/'+encodeURIComponent('默认代理'),'PUT',{name:'香港'})).status,204);
      const empty=await request(mixedPort,'http://foreign-smoke.test:'+targetPort+'/empty');
      assert.notEqual(empty.data,'DIRECT');assert.notEqual(empty.data,'PROXY');assert.equal(empty.status,502);
      results.push({variant,version,startup:'passed',providerFetch:'passed',regionAndRateFilters:'passed',defaultSelections:'passed',domesticDirect:'passed',foreignProxy:'passed',liveProviderRefresh:'passed',emptyRegionFailClosed:'passed'});
      await stopChild();
    }
    console.log(JSON.stringify(results,null,2));
    fs.writeFileSync(path.join(work,'runtime-results.json'),JSON.stringify(results,null,2));
  } finally {
    await stopChild();for(const socket of peers)socket.destroy();
    await Promise.all([new Promise(resolve=>target.close(resolve)),new Promise(resolve=>provider.close(resolve)),new Promise(resolve=>socks.close(resolve)),new Promise(resolve=>dns.close(resolve))]);
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
