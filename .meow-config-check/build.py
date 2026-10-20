import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
snapshots = json.loads((root / '.meow-config-check/snapshots.json').read_text(encoding='utf-8'))

for lite in (False, True):
    suffix = 'Lite' if lite else ''
    text = (root / f'Config/mihomoConfig{suffix}.yaml').read_text(encoding='utf-8')
    text = text.replace(f'#  mihomo配置（{"精简版" if lite else "全量版"}）', f'#  meow配置（{"精简版" if lite else "全量版"}）')
    text = text.replace('#  配置链接：', '#  原版配置链接：', 1)
    notes = '''# meow 适配目标：0.25.0-alpha+801ada1，与根目录 MeowScript.js 使用相同的适配方式。
# 使用前填写 provider1.url；新增订阅时复制 provider1 并修改名称、url 和 path。
# 这是独立配置，不要再叠加当前 MeowScript.js 覆写（该脚本拒绝 proxy-providers 输入）。
# meow 暂不支持 age 订阅解密和 additional-prefix：使用普通 Clash YAML 订阅，
# 多个订阅的节点名称需在订阅源/转换器中确保唯一；这些功能无法仅用配置等效实现。
# 默认关闭 IPv6、TUN；使用系统代理。TUN 由 Nyanpasu 按需启用，不强制实验性全局路由。
# tcp-connect-timeout 使内置 DIRECT 在单个 IP 超时后尝试下一地址，不等同于 tcp-concurrent。
# 直连组使用内置 DIRECT；meow 暂无 Mihomo 的五种节点 ip-version 选项。
# 国内 DNS 使用直连 DoT；国外 DNS 使用经“默认代理”的 TCP DNS，出口至 DNS 服务的一段未加密。
# nameserver-policy 中 private 的 192.168.1.1 是当前局域网 DNS；换网络后按实际内网 DNS 修改。
# provider 节点域名通过 proxy-server-nameserver 独立解析，避免与代理 DNS 互相依赖。
# Fake-IP 排除列表是脚本内同一份 2026-10-20 快照，不会跟随远程规则集自动更新。
# default-selected 改为首项；meow 的选择记忆由内核自身管理。
'''
    if not lite:
        notes += '# 负载均衡改用 consistent-hashing，按目标保持稳定映射；不等同于 sticky-sessions 的会话机制。\n'
    text = text.replace('# --- 锚点定义 (通用属性) ---', notes + '\n# --- 锚点定义 (通用属性) ---', 1)
    text = text.replace("health-check: { enable: true, url: https://www.apple.com/library/test/success.html, interval: 600, lazy: true }", "health-check: { enable: true, url: https://www.apple.com/library/test/success.html }")
    text = text.replace('# 订阅提供者，如果你想要添加多个订阅提供者，可以复制 provider1 的配置块，并修改 url 、 path 和 additional-prefix 字段。', '# 订阅提供者。定时测速由下方 url-test / load-balance 策略组执行（600 秒）；provider health-check 本身不调度。')
    text = re.sub(r'^    age-secret-key:.*\n', '', text, flags=re.M)
    text = re.sub(r'^    override:\n      additional-prefix:.*\n', '', text, flags=re.M)
    text = re.sub(r'^#   age-secret-key:.*\n|^#   override:\n#     additional-prefix:.*\n', '', text, flags=re.M)
    text = re.sub(r'proxies:\n(?:  - \{ name:.*\n){5}', 'proxies: []\n', text, count=1)
    text = text.replace('ipv6: true\n', 'ipv6: false\n', 1)
    for key in ['unified-delay', 'tcp-concurrent', 'keep-alive-interval', 'find-process-mode', 'external-ui', 'external-ui-url']:
        text = re.sub(rf'^{key}:.*\n', '', text, flags=re.M)
    text = text.replace('log-level: info\n', 'log-level: info\ntcp-connect-timeout: 2\n', 1)
    text = re.sub(r'^profile:\n(?:  .*\n)+\n', '', text, flags=re.M)
    text = re.sub(r'^dns_common:\n.*?(?=^dns:)', '''dns_common:
  chinaDNS: &chinaDNS ['tls://119.29.29.29', 'tls://223.5.5.5']
  foreignDNS: &foreignDNS ['tcp://1.1.1.1:53#默认代理', 'tcp://8.8.8.8:53#默认代理']
  defaultDNS: &defaultDNS ['tls://119.29.29.29', 'tls://223.5.5.5']
  proxyServerDNS: &proxyServerDNS ['tls://119.29.29.29', 'tls://223.5.5.5']

''', text, flags=re.M | re.S)
    text = text.replace('dns:\n  enable: true\n', "dns:\n  enable: true\n  listen: '127.0.0.1:1053'\n  store-fake-ip: true\n", 1)
    for key in ['ipv6', 'cache-algorithm', 'use-system-hosts', 'fake-ip-range6', 'direct-nameserver', 'direct-nameserver-follow-policy']:
        text = re.sub(rf'^  {key}:.*\n', '', text, flags=re.M)
    fake = list(dict.fromkeys(v for section in ['private', 'compatibility', 'china'] + ([] if lite else ['fcm']) for v in snapshots[section]))
    expanded = '  # meow 的 fake-ip-filter 不支持 rule-set 引用，以下为对应规则集的域名展开快照。\n  fake-ip-filter:\n' + ''.join("    - '" + v.replace("'", "''") + "'\n" for v in fake)
    text = re.sub(r'^  fake-ip-filter:.*\n', lambda m: expanded, text, count=1, flags=re.M)
    text = text.replace("'rule-set:private': 'system'", "'rule-set:private': ['192.168.1.1']")
    text = text.replace("'rule-set:douyin': ['system', '180.184.1.1', '180.184.2.2']", "'rule-set:douyin': ['180.184.1.1#DIRECT', '180.184.2.2#DIRECT']")
    text = text.replace("    'rule-set:cn': *chinaDNS", "    'rule-set:cn': *chinaDNS\n    'rule-set:geolocation-cn': *chinaDNS")
    text = re.sub(r'^ntp:\n.*?(?=^tun:)', '', text, flags=re.M | re.S)
    text = re.sub(r'^tun:\n.*?(?=^# --- 规则集)', '''# 按需在 Nyanpasu 中启用；布尔 auto-route 沿用内核默认路由方式。
tun:
  enable: false
  auto-route: true
  dns-hijack: ['any:53']

''', text, flags=re.M | re.S)
    text = text.replace('interval: 86400, behavior:', 'interval: 86400, proxy: DIRECT, behavior:')
    text = re.sub(r"^    '?path-in-bundle'?:.*\n", '', text, flags=re.M)
    text = re.sub(r'^  fakeip_filter:\n.*?(?=^  cn_additional:)', '', text, flags=re.M | re.S)
    text = re.sub(r'^      (?:timeout|max-failed-times|empty-fallback):.*\n', '', text, flags=re.M)
    text = re.sub(r'(&group_common_select \{\n)\s*type: select,\n.*?^    \}', r'\1      type: select,\n    }', text, count=1, flags=re.M | re.S)
    text = text.replace("strategy: 'sticky-sessions'", "strategy: 'consistent-hashing'")
    # meow 的 include-all 只引入 provider；另加 include-all-proxies 保留自定义静态节点。
    # 静态节点不会经过 meow 的组过滤器，使用 file provider 才能参与地区/倍率过滤。
    text = text.replace('# 节点配置，可添加自定义节点', '# 自定义节点建议通过 file 类型 provider 引入，使地区/倍率过滤生效。\n# 此处静态节点需在策略组 proxies 中显式引用。')
    text = text.replace('# 策略组通用配置', '# 策略组通用配置\n# meow 无 empty-fallback；无匹配节点的 provider 组会连接失败，不会回退直连。')
    text = text.replace("'(?i)(", "'(?i)(")  # 保留原有 Unicode / 大小写规则。
    text = text.replace('(?<![A-Za-z])', '(?:^|[^A-Za-z])').replace('(?![A-Za-z])', '(?:$|[^A-Za-z])')
    text = text.replace(r'(?<![\d.])', r'(?:^|[^\d.])')
    text = text.replace('^(?!.*(?:剩|期)).*', '.*').replace('^(?!.*(?:客户端|软件)).*下载', '.*下载')
    text = text.replace("# 地区过滤器正则表达式定义", "# 地区过滤器正则表达式定义\n# Rust 正则不支持环视：地区/数值边界改用显式边界；YAML 单引号中反斜杠只写一次。\n# 低倍率各分支分别保留原排除条件；下载分支用无环视状态表达式排除“客户端/软件”。")
    text = text.replace("  high_filter:\n", "  high_filter:\n", 1)
    low_start = text.index('  low_filter:\n')
    low_end = text.index('  high_filter:\n', low_start)
    clean = r'(?:[^客软]|软+[^件客软]|软*客(?:客|户客|户?软+客)*(?:[^客户软]|户[^客端软]|户?软+[^件客软]))*(?:软*|软*客(?:客|户客|户?软+客)*(?:户?|户?软+))'
    low_regex = r'(?i)(^(?:[^剩期]*[^\d.剩期])?0(?:\.[0-5]|[*×✕✖⨯⨉x倍])[^剩期]*$|[*×✕✖⨯⨉x]0|^' + clean + '下载' + clean + r'$|低倍|免费|(?:^|[^A-Za-z])free(?:$|[^A-Za-z]))'
    low_block = "  low_filter:\n    &low_filter {\n      filter: '" + low_regex + "',\n    }\n"
    text = text[:low_start] + low_block + text[low_end:]
    # default-selected 的默认候选只影响该组，不能修改共用锚点列表。
    parts = re.split(r'(?=^  - name:)', text, flags=re.M)
    for i in range(1, len(parts)):
        block = parts[i]
        match = re.search(r"^    default-selected: '([^']+)'\n", block, flags=re.M)
        if match:
            default = match[1]
            direct = '*proxies_direct' in block
            candidates = ['默认代理', '手动选择', '自动选择'] + ([] if lite else ['负载均衡']) + (['直连'] if direct else []) + ['香港', '日本', '美国', '新加坡', '台湾', '低倍率节点', '高倍率节点', '其他节点']
            candidates.remove(default)
            candidates.insert(0, default)
            block = block.replace(match[0], '')
            line = "    proxies: [" + ', '.join(repr(v) for v in candidates) + "]\n"
            block = re.sub(r'(^    <<:.*\n)', lambda m: m[0] + line, block, count=1, flags=re.M)
        block = re.sub(r"^    proxies: \['🇨🇳 直连.*\n", "    proxies: ['DIRECT']\n", block, flags=re.M)
        parts[i] = block
    text = ''.join(parts)
    text = text.replace('  # 国内直连\n', '''  # 国内媒体先按域名直连，保留域名供 DIRECT 尝试多个 CDN 地址。
  - DOMAIN,www.bilibili.com,直连
  - DOMAIN,api.bilibili.com,直连
  - DOMAIN-SUFFIX,biliapi.net,直连
  - DOMAIN-SUFFIX,biliapi.com,直连
  - DOMAIN-SUFFIX,bilivideo.com,直连
  - DOMAIN-SUFFIX,bilivideo.cn,直连
  - DOMAIN-SUFFIX,bilivideo.net,直连
  - DOMAIN-SUFFIX,hdslb.com,直连
  - DOMAIN-SUFFIX,hdslb.net,直连
  - DOMAIN-SUFFIX,acgvideo.com,直连

  # 国内直连
''', 1)
    text = re.sub(r'^  - AND,\(\(NETWORK,UDP\).*$', '  - SUB-RULE,meow-quic', text, count=1, flags=re.M)
    text += '''
# meow 逻辑规则不能内嵌 RULE-SET；PASS 返回主规则链继续分流。
sub-rules:
  meow-quic:
    - NOT,((AND,((NETWORK,UDP),(DST-PORT,443)))),PASS
    - RULE-SET,cn_additional,PASS
    - RULE-SET,cn_ip,PASS,no-resolve
    - AND,((NETWORK,UDP),(DST-PORT,443)),REJECT
'''
    text = re.sub(r"((?:exclude-)?filter: ')([^']*)(')", lambda m: m[1] + m[2].replace('\\\\', '\\').replace(r'\/', '/') + m[3], text)
    (root / f'Config/MeowConfig{suffix}.yaml').write_text(text, encoding='utf-8', newline='\n')
    print(f'MeowConfig{suffix}.yaml: {len(fake)} fake-IP exclusions')
