'use strict';

const { CONFIG_FILES, loadConfig } = require('../lib/config-loader');
const { loadScript } = require('../lib/loader');
const { MEOW_SCRIPT } = require('../lib/scripts');

const builtins = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'PASS-RULE', 'COMPATIBLE'];
const refreshedDomains = ['localhost.weixin.qq.com', 'localhost.work.weixin.qq.com', '+.szu.app', '+.szu.moe'];

function scriptConfig(lite) {
  const api = loadScript(MEOW_SCRIPT);
  api.ruleOptionsEnable.FCM = !lite;
  return api.main({ proxies: [{ name: '香港校验', type: 'ss', server: '198.51.100.1', port: 8388, cipher: 'aes-128-gcm', password: 'test-only' }] });
}

function runConfigTests(h) {
  for (const file of CONFIG_FILES) {
    h.section(`Meow 独立配置 · ${file}`);
    const lite = file.includes('Lite');
    h.test('YAML 锚点可解析为完整的提供者和策略组配置', () => {
      const config = loadConfig(file);
      h.assertEqual(config['proxy-providers'].provider1.type, 'http');
      h.assertEqual(config['proxy-providers'].provider1.url, '', '保留供用户填写的订阅链接');
      h.assertEqual(config['proxy-groups'].find((group) => group.name === '自动选择').type, 'url-test');
      h.assertEqual(config['proxy-groups'].some((group) => group.name === 'FCM'), !lite);
    });
    h.test('组名唯一，节点、提供者、规则集和子规则引用均存在', () => {
      const config = loadConfig(file);
      const groups = config['proxy-groups'];
      const names = groups.map((group) => group.name);
      h.assertEqual(new Set(names).size, names.length);
      const known = new Set([...names, ...builtins, ...config.proxies.map((proxy) => proxy.name)]);
      for (const group of groups) {
        for (const name of group.proxies || []) h.assert(known.has(name), `${group.name} 引用了不存在的目标 ${name}`);
        for (const name of group.use || []) h.assert(config['proxy-providers'][name], `缺少提供者 ${name}`);
      }
      for (const rule of [...config.rules, ...Object.values(config['sub-rules'] || {}).flat()]) {
        if (rule.startsWith('SUB-RULE,')) {
          h.assert(config['sub-rules'][rule.slice('SUB-RULE,'.length)], `缺少子规则 ${rule}`);
          continue;
        }
        const parts = rule.split(',');
        const target = parts[parts.length - (parts[parts.length - 1] === 'no-resolve' ? 2 : 1)];
        h.assert(known.has(target), `规则引用不存在的目标 ${rule}`);
        for (const match of rule.matchAll(/RULE-SET,([^,)]+)/g)) h.assert(config['rule-providers'][match[1]], `缺少规则集 ${match[1]}`);
      }
    });
    h.test('上游 exclude-type 修复：过滤锚点不夹带类型，其他节点显式排除 DIRECT', () => {
      const config = loadConfig(file);
      h.assert(!('exclude-type' in config.group_filter.exclude_filter));
      h.assertEqual(config['proxy-providers'].provider1['exclude-type'], 'DIRECT|REJECT|REMATCH');
      for (const name of ['其他节点', '其他节点-自动选择']) {
        const group = config['proxy-groups'].find((entry) => entry.name === name);
        h.assertEqual(group['exclude-type'], 'DIRECT');
        h.assertEqual(group['exclude-filter'], config.group_filter.exclude_filter['exclude-filter']);
        h.assertEqual(group['include-all'], true);
      }
    });
    h.test('DNS 出口可用，节点独立解析，默认不启用 TUN 或 IPv6', () => {
      const config = loadConfig(file);
      const dns = config.dns;
      h.assertDeep(dns.nameserver, ['tcp://1.1.1.1:53#默认代理', 'tcp://8.8.8.8:53#默认代理']);
      h.assertDeep(dns['proxy-server-nameserver'], ['tls://119.29.29.29', 'tls://223.5.5.5']);
      h.assertDeep(dns['nameserver-policy']['rule-set:private'], ['192.168.1.1']);
      for (const key of Object.keys(dns['nameserver-policy'])) {
        if (key.startsWith('rule-set:')) h.assert(config['rule-providers'][key.slice('rule-set:'.length)], `DNS 缺少规则集 ${key}`);
      }
      h.assertEqual(config.tun.enable, false);
      h.assertEqual(config.ipv6, false);
      h.assertEqual(config['tcp-connect-timeout'], 2);
      for (const field of ['direct-nameserver', 'proxy-server-nameserver-policy', 'fake-ip-range6', 'cache-algorithm']) h.assert(!(field in dns), `不能输出不支持的 DNS 字段 ${field}`);
    });
    h.test('Fake-IP 展开名单与脚本一致，包含本次上游新增项', () => {
      const actual = loadConfig(file).dns['fake-ip-filter'];
      const expected = scriptConfig(lite).dns['fake-ip-filter'];
      const actualSet = new Set(actual);
      const expectedSet = new Set(expected);
      h.assertEqual(actualSet.size, actual.length, '静态名单不应有重复项');
      const missing = [...expectedSet].filter((domain) => !actualSet.has(domain));
      const extra = [...actualSet].filter((domain) => !expectedSet.has(domain));
      h.assert(!missing.length && !extra.length, `名单差异：缺少 ${missing.slice(0, 4)}；多出 ${extra.slice(0, 4)}`);
      h.assert(!actual.some((domain) => domain.startsWith('rule-set:')), 'Fake-IP 不能使用内核不支持的 rule-set 引用');
      for (const domain of refreshedDomains) h.assert(actualSet.has(domain), `缺少本次新增域名 ${domain}`);
      h.assertEqual(actualSet.has('mtalk.google.com'), !lite);
    });
    h.test('国内媒体和 ctaiot 规则优先于代理兜底', () => {
      const config = loadConfig(file);
      const fallback = config.rules.indexOf('RULE-SET,geolocation-!cn,默认代理');
      for (const rule of ['DOMAIN-SUFFIX,ctaiot.com,直连', 'DOMAIN-SUFFIX,bilivideo.com,直连']) {
        const index = config.rules.indexOf(rule);
        h.assert(index >= 0 && index < fallback, `前置直连规则顺序错误 ${rule}`);
      }
      h.assertDeep(config.dns['nameserver-policy']['+.ctaiot.com'], ['tls://119.29.29.29', 'tls://223.5.5.5']);
    });
  }
}

module.exports = { runConfigTests };
