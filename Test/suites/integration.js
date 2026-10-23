'use strict';

const groupByName = (groups, name) => groups.find((g) => g.name === name);
const proxyNames = (proxies) => proxies.map((p) => p.name);

/** 临时修改 ruleOptionsEnable 的若干选项，执行完成后恢复，避免污染后续用例 */
function withOptions(api, patch, fn) {
  const saved = {};
  for (const key of Object.keys(patch)) {
    saved[key] = api.ruleOptionsEnable[key];
    api.ruleOptionsEnable[key] = patch[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(patch)) api.ruleOptionsEnable[key] = saved[key];
  }
}

/**
 * 集成测试：直接调用 main() 对模拟订阅进行覆写并断言输出。
 * meta: { full, regions }
 */
function runIntegrationTests(h, api, meta, fx, loadScript, scriptFile) {
  // ---------------- 节点过滤与标准化 ----------------
  h.section('集成测试 · 节点过滤与标准化');
  h.test('节点过滤与标准化：剔除无效节点、保留有效节点并补国旗', () => {
    const out = api.main(fx.typicalSubscription());
    const n = proxyNames(out.proxies);
    for (const bad of ['DIRECT', 'REJECT', 'REMATCH', '官方网站', '剩余流量', '节点到期 2026-08-01']) {
      h.assert(!n.includes(bad), `不应包含节点 ${bad}`);
    }
    h.assert(n.includes('🇭🇰 HK 02 - 香港'));
    h.assert(n.includes('🇯🇵 JAPAN-02'));
    h.assert(n.includes('🇸🇬 SG 01 | 新加坡'));
  });
  h.test('dialer-proxy 引用修复：重命名同步 / 存活保留 / 被过滤移除', () => {
    const out = api.main(fx.typicalSubscription());
    // 指向被重命名节点 → 引用同步更新
    const renamed = out.proxies.find((x) => x.name === '🇯🇵 东京');
    h.assert(renamed, '节点 🇯🇵 东京 应存在');
    h.assertEqual(renamed['dialer-proxy'], '🇯🇵 日本大阪');
    // 指向存活未改名节点 → 引用保留
    const alive = out.proxies.find((x) => x.name === '🇭🇰 香港 04');
    h.assertEqual(alive['dialer-proxy'], '🇭🇰 香港 01 | 中转');
    // 指向被过滤节点 → 移除引用
    const filtered = out.proxies.find((x) => x.name === '测试节点A');
    h.assert(filtered, '节点 测试节点A 应存在');
    h.assert(!('dialer-proxy' in filtered), '应移除指向已过滤节点的引用');
  });
  h.test('标准化后重名节点去重，保留首个且地区组不重复', () => {
    const cfg = fx.minimalSubscription();
    // 与既有 '🇭🇰 香港 A' 归一化后同名的节点（'香港 A' → '🇭🇰 香港 A'）
    cfg.proxies.push({
      name: '香港 A',
      type: 'ss',
      server: 'dup.example.com',
      port: 443,
      cipher: 'aes-256-gcm',
      password: 'x',
    });
    const out = api.main(cfg);
    const n = proxyNames(out.proxies);
    h.assertEqual(n.filter((x) => x === '🇭🇰 香港 A').length, 1, '同名节点应只保留一个');
    h.assertEqual(out.proxies.find((p) => p.name === '🇭🇰 香港 A').server, 'a.example.com', '应保留首个出现的节点');
    const hkGroup = groupByName(out['proxy-groups'], '香港');
    h.assertEqual(hkGroup.proxies.filter((x) => x === '🇭🇰 香港 A').length, 1, '地区组内不应出现重复节点');
  });

  h.test('节点名含零宽字符：匹配期剥离后地区/过滤正常，且节点名不被改写', () => {
    const zw = fx.withInvisibleChars;
    const out = api.main(fx.invisibleCharsSubscription());
    const n = proxyNames(out.proxies);

    // 1. 节点名必须保持原样（不可见字符仍在），不做任何清洗改写
    h.assert(n.includes(`🇭🇰 ${zw('HK 01')}`), 'HK 01 应补国旗并保留原名中的不可见字符');
    h.assert(n.includes('🇸🇬 \u3164SG\uFFA0 03'), 'SG 03 应补国旗并保留谚文填充符');
    h.assert(!n.some((x) => x === '🇭🇰 HK 01'), '不得输出被清洗过的名字（说明发生了改写）');

    // 2. 匹配不受影响：地区识别、信息节点过滤、倍率判断均正常
    h.assert(!n.some((x) => x.includes('官网')), '信息节点应被过滤');
    h.assert(groupByName(out['proxy-groups'], '香港').proxies.includes(`🇭🇰 ${zw('HK 01')}`), '应归入香港地区组');
    h.assert(groupByName(out['proxy-groups'], '新加坡').proxies.includes('🇸🇬 \u3164SG\uFFA0 03'), '应归入新加坡地区组');

    // 3. dialer-proxy 引用照常同步（名字只被补了国旗，未发生清洗）
    const us = out.proxies.find((x) => x.name === `🇺🇸 ${zw('US 04')}`);
    h.assert(us, 'US 04 应存在');
    h.assertEqual(us['dialer-proxy'], `🇭🇰 ${zw('HK 01')}`, 'dialer-proxy 应同步为补国旗后的名字');
  });

  // ---------------- GLOBAL 策略组 ----------------
  h.section('集成测试 · GLOBAL 策略组');
  h.test('GLOBAL 聚合所有策略组', () => {
    const out = api.main(fx.typicalSubscription());
    const global = groupByName(out['proxy-groups'], 'GLOBAL');
    h.assert(global, '缺少 GLOBAL 组');
    for (const g of out['proxy-groups']) {
      if (g.name !== 'GLOBAL') {
        h.assert(global.proxies.includes(g.name), `GLOBAL 缺少策略组 ${g.name}`);
      }
    }
  });

  // ---------------- DNS 与 hosts ----------------
  h.section('集成测试 · Meow DNS 与 hosts');
  h.test('固定公共 DNS 与精确节点策略：合并私有 DNS，公共 DNS 不进入节点兜底', () => {
    const cfg = fx.typicalSubscription();
    delete cfg.dns.listen;
    delete cfg.dns['proxy-server-nameserver-policy'];
    cfg.dns.nameserver = ['8.8.8.8', 'https://private.example-dns.com/dns-query#proxy'];
    cfg.dns['proxy-server-nameserver'] = ['223.5.5.5', 'https://private-proxy.example-dns.com/dns-query#proxy'];
    const out = api.main(cfg);
    h.assertEqual(out.dns.enable, true);
    h.assertEqual(out.dns['enhanced-mode'], 'fake-ip');
    h.assertDeep(out.dns['default-nameserver'], api.defaultDNS);
    h.assert(!('proxy-server-nameserver' in out.dns), '脚本应让节点使用主解析器的精确策略');
    h.assert(!('proxy-server-nameserver-policy' in out.dns), '不能输出不支持的节点 DNS policy 字段');
    const domains = out.proxies.map((p) => p.server).filter((server) => !api.isIpAddress(server));
    for (const domain of domains) {
      h.assertDeep(out.dns['nameserver-policy'][domain], [
        'https://private.example-dns.com/dns-query',
        'https://private-proxy.example-dns.com/dns-query',
      ]);
    }
    h.assert(!('+.example.com' in out.dns['nameserver-policy']), '节点 DNS 策略应保持精确域名，避免扩大范围');
  });
  h.test('私有 DNS 后缀：UDP/TCP 的 DIRECT 规范化，DoH/DoT 不写入假 SNI', () => {
    const cfg = fx.minimalSubscription();
    cfg.dns = {
      nameserver: [
        'tcp://192.168.50.1:53#direct',
        'tcp://192.168.50.1:53#direct&ecs=2.2.2.2',
        'https://private.example-dns.com/dns-query#DIRECT',
        'tls://192.168.50.2#默认代理',
      ],
    };
    const out = api.main(cfg);
    h.assertDeep(out.dns['nameserver-policy']['a.example.com'], [
      'tcp://192.168.50.1:53#DIRECT',
      'https://private.example-dns.com/dns-query',
      'tls://192.168.50.2',
    ]);
  });
  h.test('节点精确 DNS 优先于通配策略，不保留无关策略及映射为 IP 的原域名', () => {
    const cfg = fx.typicalSubscription();
    cfg.dns['nameserver-policy'] = {
      'jp1.example.com': 'https://private-ns.example-dns.com/dns-query#PROXY',
      'unrelated-ns.com': 'https://foo-ns.com/dns-query',
    };
    const out = api.main(cfg);
    const policy = out.dns['nameserver-policy'];
    h.assertEqual(policy['jp1.example.com'], 'https://private-ns.example-dns.com/dns-query');
    h.assertDeep(policy['hk3.example.com'], ['https://other-dns.com/dns-query']);
    h.assert(!('hk1.example.com' in policy), 'hosts 映射为 IP 后不能保留旧节点域名策略');
    h.assert(!('unrelated-ns.com' in policy));
    h.assert(!('unrelated.com' in policy));
    h.assert(!('+.example.com' in policy));
  });
  h.test('仅部分节点有专属 DNS 时，其余节点用直连公共 DNS，避免解析依赖代理', () => {
    const cfg = fx.minimalSubscription();
    cfg.dns = { 'proxy-server-nameserver-policy': { 'b.example.com': ['tcp://192.168.50.1:53#DIRECT'] } };
    const out = api.main(cfg);
    h.assertDeep(out.dns['nameserver-policy']['b.example.com'], ['tcp://192.168.50.1:53#DIRECT']);
    for (const domain of ['a.example.com', 'c.example.com', 'd.example.com']) {
      h.assertDeep(out.dns['nameserver-policy'][domain], api.proxyServerDNS);
    }
  });
  h.test('hosts 改写节点 server，域名策略与 Fake-IP 排除只保留映射后的实际域名', () => {
    const out = api.main(fx.typicalSubscription());
    h.assertEqual(out.proxies.find((p) => p.name === '🇭🇰 香港 01 | 中转').server, '10.0.0.1');
    h.assert(!('hk1.example.com' in out.hosts), '订阅 hosts 已改写节点，不应整份复制');
    const filter = out.dns['fake-ip-filter'];
    h.assert(filter.includes('+.example.com'));
    h.assert(!filter.includes('hk1.example.com'));
    h.assert(!filter.includes('www.unrelated.com'));
    h.assert(!filter.some((entry) => entry.startsWith('rule-set:')));
    const mapped = api.main(fx.hostsMappedSubscription());
    h.assert(mapped.dns['fake-ip-filter'].includes('+.example-apt.com'));
    h.assert(!mapped.dns['fake-ip-filter'].includes('+.unrelated-filter.com'));
    h.assert(mapped.dns['nameserver-policy']['node-a1b2c3.example-apt.com']);
    h.assert(!mapped.dns['nameserver-policy']['node-a1b2c3.example-node.biz']);
  });
  h.test('hosts 改写触发条件不满足时跳过，不把空监听地址写入 DNS', () => {
    for (const dns of [
      { listen: '198.18.0.1:53', 'proxy-server-nameserver': ['8.8.8.8', '198.18.0.1:53'] },
      { listen: '198.18.0.1:53', 'proxy-server-nameserver': ['8.8.8.8'] },
      { listen: '0.0.0.0:7874', 'proxy-server-nameserver': ['udp://1.2.3.4:7874'] },
      { listen: '198.18.0.1:53', 'proxy-server-nameserver': ['udp://127.0.0.1:7874'] },
      { 'proxy-server-nameserver': ['198.18.0.1:53'] },
      { listen: '', 'proxy-server-nameserver': ['198.18.0.1:53'] },
    ]) {
      const cfg = fx.typicalSubscription();
      cfg.dns = dns;
      const out = api.main(cfg);
      h.assertEqual(out.proxies.find((p) => p.name === '🇭🇰 香港 01 | 中转').server, 'hk1.example.com');
      h.assert(Object.values(out.dns['nameserver-policy']).every((value) => value !== ''));
    }
  });
  h.test('本机 DNS 监听触发 hosts 改写，原监听 DNS 不被保留为节点 DNS', () => {
    for (const localDns of ['udp://127.0.0.1:7874', 'udp://127.0.0.1:5353']) {
      const cfg = fx.typicalSubscription();
      cfg.dns.listen = '0.0.0.0:7874';
      cfg.dns['proxy-server-nameserver'] = [localDns];
      delete cfg.dns['proxy-server-nameserver-policy'];
      const out = api.main(cfg);
      h.assertEqual(out.proxies.find((p) => p.name === '🇭🇰 香港 01 | 中转').server, '10.0.0.1');
      h.assertDeep(out.dns['nameserver-policy']['jp1.example.com'], ['https://private.example-dns.com/dns-query']);
    }
  });
  h.test('无 dns/hosts 输入时生成默认 DNS、固定 hosts 和每个节点的独立解析策略', () => {
    const cfg = fx.minimalSubscription();
    const out = api.main(cfg);
    h.assertDeep(out.dns['default-nameserver'], api.defaultDNS);
    for (const proxy of out.proxies) h.assertDeep(out.dns['nameserver-policy'][proxy.server], api.proxyServerDNS);
    h.assertDeep(out.hosts['doh.pub'], ['1.12.12.12', '120.53.53.53']);
    h.assertDeep(out.hosts['services.googleapis.cn'], 'services.googleapis.com');
  });

  // ---------------- 配置选项切换 ----------------
  h.section('集成测试 · 配置选项切换');
  h.test('过滤高倍率节点=true → 移除高倍率节点及组', () =>
    withOptions(api, { 过滤高倍率节点: true }, () => {
      const out = api.main(fx.minimalSubscription());
      h.assert(!proxyNames(out.proxies).some((name) => name.includes('2x 高倍率')), '高倍率节点应被过滤');
      h.assert(!groupByName(out['proxy-groups'], '高倍率节点'), '不应生成高倍率组');
      h.assert(groupByName(out['proxy-groups'], '日本'), '日本组仍应存在');
    }),
  );
  h.test('过滤低倍率节点=true → 移除低倍率节点及组', () =>
    withOptions(api, { 过滤低倍率节点: true }, () => {
      const out = api.main(fx.typicalSubscription());
      h.assert(
        !proxyNames(out.proxies).some((name) => name.includes('0.3x') || name.includes('0.5倍')),
        '低倍率节点应被过滤',
      );
      h.assert(!groupByName(out['proxy-groups'], '低倍率节点'), '不应生成低倍率组');
      h.assert(groupByName(out['proxy-groups'], '日本'), '日本组仍应存在');
    }),
  );
  h.test('生成倍率组=false → 不生成倍率组，节点按地区归类', () =>
    withOptions(api, { 生成倍率组: false }, () => {
      const out = api.main(fx.typicalSubscription());
      h.assert(!groupByName(out['proxy-groups'], '低倍率节点'), '不应生成低倍率组');
      h.assert(!groupByName(out['proxy-groups'], '高倍率节点'), '不应生成高倍率组');
      h.assert(
        proxyNames(out.proxies).some((n) => n.includes('0.3x')),
        '低倍率节点仍应保留',
      );
      h.assert(
        proxyNames(out.proxies).some((n) => n.includes('2x 速率')),
        '高倍率节点仍应保留',
      );
      h.assert(
        groupByName(out['proxy-groups'], '香港').proxies.some((n) => n.includes('0.5倍')),
        '倍率节点应按地区归类',
      );
      h.assert(
        groupByName(out['proxy-groups'], '日本').proxies.some((n) => n.includes('0.3x')),
        '倍率节点应按地区归类',
      );
    }),
  );
  h.test('生成地区自动选择组=false → 无自动选择组', () =>
    withOptions(api, { 生成地区自动选择组: false }, () => {
      const out = api.main(fx.minimalSubscription());
      h.assert(!out['proxy-groups'].some((g) => g.name.endsWith('-自动选择')), '不应有自动选择组');
      h.assert(groupByName(out['proxy-groups'], '香港'), '香港组仍应存在');
    }),
  );
  h.test('隐藏地区手动选择组=true → 地区组 hidden', () =>
    withOptions(api, { 隐藏地区手动选择组: true }, () => {
      const out = api.main(fx.minimalSubscription());
      h.assertEqual(groupByName(out['proxy-groups'], '香港').hidden, true);
    }),
  );
  h.test('分流组添加所有节点=true → 分流组含全部节点', () =>
    withOptions(api, { 分流组添加所有节点: true }, () => {
      const out = api.main(fx.minimalSubscription());
      h.assert(groupByName(out['proxy-groups'], 'AI').proxies.includes('🇭🇰 香港 A'), 'AI 组应含全部节点');
    }),
  );
  h.test('屏蔽国外QUIC 开关：true 生成 / false 移除 QUIC 规则与 cn_additional', () => {
    // true（默认）→ 生成 cn_additional 规则集
    h.assert(api.main(fx.minimalSubscription())['rule-providers'].cn_additional, 'cn_additional 规则集应生成');
    // false → 移除 QUIC 规则与 cn_additional，cn 规则集保留
    withOptions(api, { 屏蔽国外QUIC: false }, () => {
      const out = api.main(fx.minimalSubscription());
      h.assert(!out.rules.some((r) => r.includes('DST-PORT,443') && r.includes('REJECT')), '不应含 QUIC 规则');
      h.assert(!out['rule-providers'].cn_additional, 'cn_additional 规则集不应生成');
      h.assert(out['rule-providers'].cn, 'cn 规则集仍应生成（供 nameserver-policy 使用）');
    });
  });
  h.test('关闭 AI 分流组 → 移除组/规则/规则集', () =>
    withOptions(api, { AI: false }, () => {
      const out = api.main(fx.minimalSubscription());
      h.assert(!groupByName(out['proxy-groups'], 'AI'), 'AI 组应被移除');
      h.assert(!out.rules.includes('RULE-SET,ai,AI'), 'AI 规则应被移除');
      h.assert(!out['rule-providers'].ai, 'ai 规则集应被移除');
    }),
  );
  h.test('关闭手动选择基础组 → 默认代理不含手动选择', () =>
    withOptions(api, { 手动选择: false }, () => {
      const out = api.main(fx.minimalSubscription());
      h.assert(!groupByName(out['proxy-groups'], '手动选择'), '手动选择组应被移除');
      h.assert(!groupByName(out['proxy-groups'], '默认代理').proxies.includes('手动选择'), '默认代理不应含手动选择');
    }),
  );
  h.test('过滤非地区节点=false → 保留信息节点', () =>
    withOptions(api, { 过滤非地区节点: false }, () => {
      const out = api.main(fx.minimalSubscription());
      h.assert(proxyNames(out.proxies).includes('官网公告'), '信息节点应被保留');
    }),
  );

  h.section('集成测试 · Meow 运行字段与 TUN 继承');
  h.test('订阅和自建节点都剔除不支持的 ip-version，直连使用内置 DIRECT', () => {
    const cfg = fx.minimalSubscription();
    cfg.proxies[0]['ip-version'] = 'ipv6-prefer';
    const customApi = loadScript(scriptFile, (code) => code.replace(
      'const customizeProxies = [];',
      "const customizeProxies = [{name:'自建独享',type:'ss',server:'custom.example.net',port:443,cipher:'aes-256-gcm',password:'x','ip-version':'ipv6'}];",
    ));
    const out = customApi.main(cfg);
    h.assert(out.proxies.every((proxy) => !('ip-version' in proxy)), '订阅与自建节点都不能携带不支持的 ip-version');
    h.assert(out.proxies.every((proxy) => proxy.type !== 'direct'));
    h.assertDeep(groupByName(out['proxy-groups'], '直连').proxies, ['DIRECT']);
    h.assertEqual(out.ipv6, false);
    h.assertEqual(out['tcp-connect-timeout'], 2);
  });
  h.test('TUN 仅继承受支持字段，不强制启用或替换现有路由方式', () => {
    const cfg = fx.minimalSubscription();
    cfg.tun = { enable: false, device: 'test-tun', mtu: 1400, 'auto-route': false, 'dns-hijack': ['any:53'], stack: 'mixed', 'strict-route': true, 'auto-redirect': true };
    const out = api.main(cfg);
    h.assertDeep(out.tun, { enable: false, device: 'test-tun', mtu: 1400, 'auto-route': false, 'dns-hijack': ['any:53'] });
    h.assert(!api.main(fx.minimalSubscription()).tun);
  });

  // ---------------- 自定义节点 ----------------
  h.section('集成测试 · 自定义节点');
  h.test('配置自定义节点 → 自建节点组/重名前缀/独立 DNS/不参与 hosts 改写', () => {
    // 重新加载脚本并注入自定义节点（与订阅节点“香港 01 | 中转”标准化后重名）
    const customApi = loadScript(scriptFile, (code) =>
      code.replace(
        'const customizeProxies = [];',
        `const customizeProxies = [
          { name: '香港 01 | 中转', type: 'ss', server: 'custom1.example.com', port: 443, cipher: 'aes-256-gcm', password: 'x' },
          { name: '自建独享', type: 'vmess', server: 'custom2.example.com', port: 443, uuid: 'x', alterId: 0 },
        ];`,
      ),
    );
    const cfg = fx.typicalSubscription();
    // 为自定义节点域名添加 hosts 映射，验证自定义节点不参与 hosts 改写
    cfg.hosts['custom1.example.com'] = '9.9.9.9';
    const out = customApi.main(cfg);
    const n = proxyNames(out.proxies);

    // 标准化后与订阅节点重名 → 添加“自建-”前缀（国旗在前且无多余空格）；未重名 → 保持原名
    h.assert(n.includes('🇭🇰 自建-香港 01 | 中转'), '与订阅节点重名的自定义节点应加自建- 前缀');
    h.assert(n.includes('自建独享'), '未重名的自定义节点保持原名');
    h.assertEqual(n.filter((x) => x === '🇭🇰 香港 01 | 中转').length, 1, '订阅节点仍应唯一保留');

    // 自定义节点不参与 hosts 改写（server 保持原域名）
    const cp = out.proxies.find((x) => x.name === '🇭🇰 自建-香港 01 | 中转');
    h.assertEqual(cp.server, 'custom1.example.com', '自定义节点不应被 hosts 改写');

    // 自建节点策略组
    const g = groupByName(out['proxy-groups'], '自建节点');
    h.assert(g, '应生成自建节点组');
    h.assertEqual(g.type, 'select');
    h.assert(g.proxies.includes('🇭🇰 自建-香港 01 | 中转'), '自建节点组应含重名自定义节点');
    h.assert(g.proxies.includes('自建独享'), '自建节点组应含未重名自定义节点');

    // 默认代理 / GLOBAL 应含自建节点组
    h.assert(groupByName(out['proxy-groups'], '默认代理').proxies.includes('自建节点'), '默认代理应含自建节点组');
    h.assert(groupByName(out['proxy-groups'], 'GLOBAL').proxies.includes('自建节点'), 'GLOBAL 应含自建节点组');

    // 手动选择（includeAll 基础组）应含自定义节点
    h.assert(
      groupByName(out['proxy-groups'], '手动选择').proxies.includes('🇭🇰 自建-香港 01 | 中转'),
      '手动选择应含自定义节点',
    );

    // 自建节点使用独立直连 DNS，避免主 DNS 经代理形成循环；订阅私有 DNS 不影响它。
    h.assert(out.dns['fake-ip-filter'].includes('custom1.example.com'));
    h.assertDeep(out.dns['nameserver-policy']['custom1.example.com'], customApi.proxyServerDNS);
  });

  // ---------------- 异常场景 ----------------
  h.section('集成测试 · 异常场景');
  h.test('无有效节点（空列表 / 全部可过滤）→ 抛错', () => {
    h.assertThrows(() => api.main(fx.emptySubscription()), /未找到任何代理节点/);
    h.assertThrows(() => api.main(fx.allFilteredSubscription()), /未找到任何代理节点/);
  });
  h.test('provider 型输入明确拒绝，避免生成不完整节点列表', () => {
    const cfg = fx.minimalSubscription();
    cfg['proxy-providers'] = { test: { type: 'file', path: './test.yaml' } };
    h.assertThrows(() => api.main(cfg), /proxy-providers/);
  });
}

module.exports = { runIntegrationTests };
