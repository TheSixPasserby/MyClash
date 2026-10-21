'use strict';

const { loadScript } = require('../lib/loader');
const { MEOW_SCRIPT } = require('../lib/scripts');

const customNode = {
  name: '自建日本 01',
  type: 'trojan',
  server: 'custom.example.net',
  port: 443,
  password: 'test-only',
};

function configuredScript(options, withCustom = false) {
  const api = loadScript(MEOW_SCRIPT, (code) =>
    code.replace('const customizeProxies = [];', `const customizeProxies = ${JSON.stringify(withCustom ? [customNode] : [])};`),
  );
  Object.assign(api.ruleOptionsEnable, options);
  return api;
}

const groupByName = (out, name) => out['proxy-groups'].find((group) => group.name === name);

/** 检查实际生成的组和规则引用，避免开关组合产生不存在的目标或循环。 */
function assertReferences(h, out) {
  const groups = new Map(out['proxy-groups'].map((group) => [group.name, group]));
  const names = [...out.proxies.map((proxy) => proxy.name), ...out['proxy-groups'].map((group) => group.name)];
  h.assertEqual(new Set(names).size, names.length, '节点和组名不得重复');
  const known = new Set([...names, 'DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'PASS-RULE', 'COMPATIBLE']);
  const visited = new Set();
  const visiting = new Set();
  function visit(name) {
    if (!groups.has(name) || visited.has(name)) return;
    h.assert(!visiting.has(name), `策略组存在循环: ${name}`);
    visiting.add(name);
    const group = groups.get(name);
    h.assert(group.proxies.length > 0, `策略组不能为空: ${name}`);
    for (const member of group.proxies) {
      h.assert(known.has(member), `${name} 引用了不存在的目标: ${member}`);
      visit(member);
    }
    visiting.delete(name);
    visited.add(name);
  }
  for (const name of groups.keys()) visit(name);

  const subRules = out['sub-rules'] || {};
  for (const rule of [...out.rules, ...Object.values(subRules).flat()]) {
    if (rule.startsWith('SUB-RULE,')) {
      h.assert(subRules[rule.slice('SUB-RULE,'.length)], `不存在的子规则: ${rule}`);
      continue;
    }
    const parts = rule.split(',');
    const action = parts[parts.length - (parts[parts.length - 1] === 'no-resolve' ? 2 : 1)];
    h.assert(known.has(action), `规则引用了不存在的目标: ${rule}`);
    for (const match of rule.matchAll(/RULE-SET,([^,)]+)/g)) {
      h.assert(out['rule-providers'][match[1]], `不存在的规则集: ${match[1]}`);
    }
  }
}

function runMeowTests(h, fx) {
  h.section('Meow · 极简模式与自动选择');
  for (const auto of [false, true]) {
    for (const withCustom of [false, true]) {
      h.test(`极简模式：自动选择${auto ? '开' : '关'} / ${withCustom ? '有' : '无'}自建节点`, () => {
        const api = configuredScript({ 极简模式: true, 自动选择: auto }, withCustom);
        const out = api.main(fx.minimalSubscription());
        const nodeNames = out.proxies.map((proxy) => proxy.name);
        const automatic = auto ? ['自动选择'] : [];
        const custom = withCustom ? ['自建节点'] : [];
        h.assertEqual(nodeNames.length, withCustom ? 5 : 4, '过滤后的订阅节点与自建节点数量');
        h.assertDeep(out['proxy-groups'].map((group) => group.name), ['GLOBAL', '默认代理', ...automatic, ...custom, '直连']);
        h.assertDeep(groupByName(out, 'GLOBAL').proxies, ['默认代理', ...custom, ...automatic, '直连']);
        h.assertDeep(groupByName(out, '默认代理').proxies, [...nodeNames, ...automatic]);
        h.assertEqual(groupByName(out, '默认代理').proxies[0], '🇭🇰 香港 A', '新增自动组不应改变默认出口');
        h.assertEqual(out.rules[out.rules.length - 1], 'MATCH,默认代理');
        if (auto) {
          const group = groupByName(out, '自动选择');
          h.assertEqual(group.type, 'url-test');
          h.assertEqual(group.hidden, true);
          h.assertDeep(group.proxies, nodeNames, '自动组应覆盖所有订阅及自建节点');
        }
        if (withCustom) {
          const name = out.proxies.find((proxy) => proxy.server === customNode.server).name;
          h.assertDeep(groupByName(out, '自建节点').proxies, [name]);
        }
        assertReferences(h, out);
      });
    }
  }

  h.test('极简全局自动选择独立于地区自动组、手动组和负载均衡开关', () => {
    const api = configuredScript({
      极简模式: true,
      自动选择: true,
      生成地区自动选择组: false,
      手动选择: false,
      负载均衡: false,
    });
    const out = api.main(fx.minimalSubscription());
    h.assertDeep(out['proxy-groups'].map((group) => group.name), ['GLOBAL', '默认代理', '自动选择', '直连']);
    h.assert(!out.rules.some((rule) => /,(FCM|Google|AI|Telegram|Steam|AdBlock)$/.test(rule)), '极简模式不应生成服务分流');
    assertReferences(h, out);
  });

  h.section('Meow · 前置直连规则与 QUIC');
  for (const minimal of [false, true]) {
    for (const quic of [false, true]) {
      h.test(`${minimal ? '极简' : '全量'}模式：ctaiot 直连 / QUIC ${quic ? '开' : '关'}`, () => {
        const api = configuredScript({ 极简模式: minimal, 屏蔽国外QUIC: quic });
        const out = api.main(fx.minimalSubscription());
        const directIndex = out.rules.indexOf('DOMAIN-SUFFIX,ctaiot.com,直连');
        h.assert(directIndex >= 0, '缺少 ctaiot.com 直连规则');
        h.assert(directIndex < out.rules.indexOf('RULE-SET,geolocation-!cn,默认代理'), '前置直连规则必须早于代理兜底');
        h.assertDeep(out.dns['nameserver-policy']['+.ctaiot.com'], ['tls://119.29.29.29', 'tls://223.5.5.5']);
        h.assertEqual(out.rules.includes('SUB-RULE,meow-quic'), quic);
        h.assertEqual(Boolean(out['rule-providers'].cn_additional), quic);
        h.assertEqual(Boolean(out['sub-rules'] && out['sub-rules']['meow-quic']), quic);
        if (quic) {
          h.assertDeep(out['sub-rules']['meow-quic'], [
            'NOT,((AND,((NETWORK,UDP),(DST-PORT,443)))),PASS',
            'RULE-SET,cn_additional,PASS',
            'RULE-SET,cn_ip,PASS,no-resolve',
            'AND,((NETWORK,UDP),(DST-PORT,443)),REJECT',
          ]);
        }
        assertReferences(h, out);
      });
    }
  }

  h.section('Meow · 现有内核兼容适配');
  h.test('全量模式保留服务分流和首项默认选择，所有引用有效', () => {
    const out = configuredScript({ 极简模式: false }).main(fx.typicalSubscription());
    h.assertEqual(groupByName(out, 'AI').proxies[0], '美国');
    h.assertEqual(groupByName(out, 'FCM').proxies[0], '直连');
    h.assert(groupByName(out, '负载均衡'), '全量模式应保留负载均衡');
    h.assertEqual(groupByName(out, '负载均衡').strategy, 'consistent-hashing');
    assertReferences(h, out);
  });

  h.test('DNS 仍使用可用的代理 TCP DNS、域名快照和节点精确策略', () => {
    const out = configuredScript({}).main(fx.typicalSubscription());
    h.assertDeep(out.dns.nameserver, ['tcp://1.1.1.1:53#默认代理', 'tcp://8.8.8.8:53#默认代理']);
    h.assertDeep(out.dns['default-nameserver'], ['tls://119.29.29.29', 'tls://223.5.5.5']);
    h.assertDeep(out.dns['nameserver-policy']['rule-set:private'], ['192.168.1.1']);
    h.assert(!out.dns['fake-ip-filter'].some((entry) => entry.startsWith('rule-set:')), '快照不能退回不支持的 rule-set 引用');
    h.assert(out.dns['fake-ip-filter'].includes('mtalk.google.com'), '全量模式应保留 FCM 排除域名');
    h.assert(out.dns['nameserver-policy']['jp1.example.com'], '节点域名应有独立 DNS 策略');
    h.assert(!('proxy-server-nameserver-policy' in out.dns));
    h.assert(!('direct-nameserver' in out.dns));
    h.assertEqual(out.ipv6, false);
    h.assert(!out.tun, '无 TUN 输入时不应强制创建 TUN 配置');
  });

  h.test('极简模式不引入 FCM 排除域名；直连及国内媒体适配保持有效', () => {
    const config = fx.minimalSubscription();
    config.proxies[0]['ip-version'] = 'ipv6';
    const out = configuredScript({ 极简模式: true }).main(config);
    h.assert(!out.dns['fake-ip-filter'].includes('mtalk.google.com'));
    h.assertDeep(groupByName(out, '直连').proxies, ['DIRECT']);
    h.assertEqual(out['tcp-connect-timeout'], 2);
    h.assert(out.proxies.every((proxy) => !('ip-version' in proxy)), '不能写回不支持的节点 ip-version');
    for (const domain of ['bilivideo.com', 'bilivideo.cn', 'hdslb.com', 'acgvideo.com']) {
      const index = out.rules.indexOf(`DOMAIN-SUFFIX,${domain},直连`);
      h.assert(index >= 0 && index < out.rules.indexOf('RULE-SET,cn_ip,直连'), `媒体域名必须优先按域名直连: ${domain}`);
    }
    h.assertDeep(out.hosts['+.mcdn.bilivideo.com'], ['0.0.0.0']);
    h.assert(Object.values(out['rule-providers']).every((provider) => provider.proxy === 'DIRECT'));
  });
}

module.exports = { runMeowTests };
