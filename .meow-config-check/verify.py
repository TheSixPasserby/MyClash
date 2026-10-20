import copy
import json
import re
import shutil
import sys
from pathlib import Path

import yaml

root = Path(__file__).resolve().parent.parent
temp = root / '.meow-config-check'
cache = Path('C:/Users/thesi/AppData/Local/Clash Nyanpasu/data/native-store/v1/meow/ruleset')
snapshots = json.loads((temp / 'snapshots.json').read_text(encoding='utf-8'))
names = ['香港 01', '日本 JP 01', '美国 US 01', '新加坡 0.5x', '台湾 2x', '德国 DE 01', '免费 Free 01']
provider = {'proxies': [dict(name=n, type='socks5', server='127.0.0.1', port=19099) for n in names]}
provider['proxies'].append(dict(name='剩余流量 100GB', type='socks5', server='127.0.0.1', port=19099))
(temp / 'provider.yaml').write_text(yaml.safe_dump(provider, allow_unicode=True), encoding='utf-8')
for lite in (False, True):
    suffix = 'Lite' if lite else ''
    kind = 'lite' if lite else 'full'
    original = yaml.safe_load((root / f'Config/mihomoConfig{suffix}.yaml').read_text(encoding='utf-8'))
    config = yaml.safe_load((root / f'Config/MeowConfig{suffix}.yaml').read_text(encoding='utf-8'))
    assert set(p['name'] for p in config['proxy-groups']) == set(p['name'] for p in original['proxy-groups'])
    for old in original['proxy-groups']:
        new = next(g for g in config['proxy-groups'] if g['name'] == old['name'])
        assert old.get('icon') == new.get('icon'), old['name']
        if 'default-selected' in old:
            assert new['proxies'][0] == old['default-selected'], old['name']
        for unsupported in ['default-selected', 'timeout', 'max-failed-times', 'empty-fallback']:
            assert unsupported not in new
        assert not re.search(r'\(\?[=!]|\(\?<[=!]', new.get('filter', '') + new.get('exclude-filter', ''))
        if new['type'] == 'select':
            assert not set(['url', 'interval', 'lazy']) & new.keys()
    assert config['hosts'] == original['hosts']
    assert config['proxy-groups'][0]['proxies'] == original['proxy-groups'][0]['proxies']
    assert set(config['rule-providers']) == set(original['rule-providers']) - {'fakeip_filter'}
    for name, rp in config['rule-providers'].items():
        old = original['rule-providers'][name]
        assert all(rp[k] == old[k] for k in ['url', 'path', 'format', 'behavior', 'interval'])
        assert rp['proxy'] == 'DIRECT'
        assert 'path-in-bundle' not in rp
    foreign_quic = next(rule for rule in original['rules'] if rule.startswith('AND,((NETWORK,UDP)'))
    assert set(original['rules']) - {foreign_quic} <= set(config['rules'])
    assert config['rules'][-4:] == original['rules'][-4:]
    assert config['rules'].index('DOMAIN-SUFFIX,bilivideo.com,直连') < config['rules'].index('RULE-SET,cn_ip,直连')
    exclusions = list(dict.fromkeys(v for section in ['private', 'compatibility', 'china'] + ([] if lite else ['fcm']) for v in snapshots[section]))
    assert config['dns']['fake-ip-filter'] == exclusions
    assert not any(v.startswith('rule-set:') for v in exclusions)
    assert config['dns']['proxy-server-nameserver'] == ['tls://119.29.29.29', 'tls://223.5.5.5']
    assert config['dns']['nameserver-policy']['rule-set:private'] == ['192.168.1.1']
    assert config['ipv6'] is False and config['tun']['enable'] is False
    assert not set(['age-secret-key', 'override']) & config['proxy-providers']['provider1'].keys()
    config['strict'] = True
    config['proxy-providers']['provider1'].update(type='file', path='./provider.yaml')
    config['proxy-providers']['provider1'].pop('url')
    home = temp / kind
    home.mkdir(exist_ok=True)
    shutil.copyfile(temp / 'provider.yaml', home / 'provider.yaml')
    for rp in config['rule-providers'].values():
        target = home / rp['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        source = cache / target.name
        if not source.is_file():
            raise RuntimeError(f'Missing real MRS cache: {source.name}')
        shutil.copyfile(source, target)
    (temp / f'{kind}.json').write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding='utf-8')
    # 保留交付 YAML 的锚点/merge，只替换测试订阅源，直接交给 meow 原生 YAML 解析器。
    native_yaml = (root / f'Config/MeowConfig{suffix}.yaml').read_text(encoding='utf-8')
    native_yaml = native_yaml.replace('    type: http,', '    type: file,', 1)
    native_yaml = native_yaml.replace("    url: '' # 此处单引号中间填入机场订阅链接\n", '', 1)
    native_yaml = native_yaml.replace('    path: ./proxy_provider/provider1.yaml', '    path: ./provider.yaml', 1)
    native_yaml += '\nstrict: true\n'
    (home / 'native.yaml').write_text(native_yaml, encoding='utf-8', newline='\n')
    print(f'{kind}: semantic checks passed; {len(config["proxy-groups"])} groups, {len(config["rule-providers"])} rule providers, {len(exclusions)} exclusions')
