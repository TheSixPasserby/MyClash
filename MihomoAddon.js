/**
 * Mihomo 附加覆写（Clash Nyanpasu）。在订阅链中放到原作者脚本之后。
 * 专用浏览器的全部 UDP 会交给 Discord。只填写专门用来通话的浏览器进程名。
 */
const discordVoiceProcesses = []; // 例如 ['firefox.exe']

const discordRuleUrl = 'https://fastly.jsdelivr.net/gh/appshubcc/bett-rules@meta/geo/geosite/discord.mrs';
const discordNativeProcess =
  '(?i)^discord(?:[- ]?(?:ptb|canary|development))?(?: helper(?: \\((?:renderer|gpu|plugin)\\))?|\\.exe)?$';

function main(config) {
  const groups = config['proxy-groups'] ?? [];
  const groupByName = new Map(groups.map((group) => [group.name, group]));
  const nodeNames = new Set((config.proxies ?? []).map((node) => node.name));
  const rules = config.rules ?? [];
  const services = [
    { name: 'Discord', icon: 'https://fastly.jsdelivr.net/gh/TheSixPasserby/MyClash@main/Icons/svg/Discord.svg' },
    { name: 'NeoSek', icon: 'https://neosek.ai/icon.svg' },
  ];

  for (const service of services) {
    // 策略组与节点共享名称空间。若同名节点已存在，保留节点并另起组名。
    let name = service.name;
    for (let suffix = 1; nodeNames.has(name); suffix++) {
      name = `${service.name} 分流${suffix === 1 ? '' : ` ${suffix}`}`;
    }
    service.name = name;
  }

  const serviceNames = new Set(services.map(({ name }) => name));
  const matchTarget = rules
    .find((rule) => /^MATCH\s*,/.test(rule))
    ?.split(',')[1]
    ?.trim();
  const isExitGroup = (name) => groupByName.has(name) && !serviceNames.has(name);
  const defaultGroup =
    ['默认代理', matchTarget].find(isExitGroup) ??
    groups.find(({ name, hidden, type }) => isExitGroup(name) && !hidden && type === 'select')?.name;
  const choices = defaultGroup
    ? [...new Set([defaultGroup, ...(groupByName.get(defaultGroup).proxies ?? []).filter(isExitGroup)])]
    : [];

  const newGroups = services
    .filter(({ name }) => !groupByName.has(name))
    .map(({ name, icon }) => ({
      name,
      type: 'select',
      icon,
      'include-all': true,
      ...(choices.length ? { proxies: choices } : {}),
    }));

  const providers = config['rule-providers'] ?? {};
  let discordProvider = Object.keys(providers).find((name) => {
    const provider = providers[name];
    return (
      provider?.type === 'http' &&
      provider.behavior === 'domain' &&
      provider.format === 'mrs' &&
      provider.url === discordRuleUrl
    );
  });
  if (!discordProvider) {
    discordProvider = 'myclash-addon-discord';
    for (let suffix = 2; Object.prototype.hasOwnProperty.call(providers, discordProvider); suffix++) {
      discordProvider = `myclash-addon-discord-${suffix}`;
    }
  }
  const discordDomains = providers[discordProvider] ?? {
    type: 'http',
    behavior: 'domain',
    format: 'mrs',
    url: discordRuleUrl,
    path: `./ruleset/${discordProvider}.mrs`,
    interval: 86400,
  };

  const [discord, neoSek] = services.map(({ name }) => name);
  const addedRules = new Set([
    `RULE-SET,${discordProvider},${discord}`,
    `DOMAIN-SUFFIX,neosek.ai,${neoSek}`,
    `DOMAIN-SUFFIX,hentai.wiki,${neoSek}`,
    `DOMAIN-SUFFIX,neohent.ai,${neoSek}`,
    `DOMAIN,hentai.loli.bi,${neoSek}`,
    `DOMAIN,node1-hentai.loli.bi,${neoSek}`,
    `AND,((NETWORK,UDP),(PROCESS-NAME-REGEX,${discordNativeProcess})),${discord}`,
    ...discordVoiceProcesses.map((process) => `AND,((NETWORK,UDP),(PROCESS-NAME,${process})),${discord}`),
  ]);

  // 放在通用 QUIC 拒绝、国内外规则和 MATCH 之前，原有规则的相对顺序保持不变。
  config.rules = [...addedRules, ...rules.filter((rule) => !addedRules.has(rule))];
  config['proxy-groups'] = [...groups, ...newGroups];
  config['rule-providers'] = { ...providers, [discordProvider]: discordDomains };
  if (config['find-process-mode'] === 'off') config['find-process-mode'] = 'strict';
  return config;
}
