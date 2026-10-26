# MyClash · Meow

用于 [meow](https://github.com/meow-rs/meow-rs) 内核的覆写脚本与配置文件，可在 Clash Nyanpasu 中使用。

配置要求 `meow 0.26.1-alpha+989a46f` 或更新的 alpha 内核，使用经代理的加密 DNS 和连接复用。已核对 Meow 源码至 `f539dc6`；上游脚本逻辑同步至 `071d4ec`。

## 选择入口

| 文件                                              | 用途                                                   |
| ------------------------------------------------- | ------------------------------------------------------ |
| [MeowScript.js](MeowScript.js)                    | 覆写机场配置，自动整理节点并生成地区、倍率和服务分流组 |
| [MeowConfig.yaml](Config/MeowConfig.yaml)         | 使用订阅提供者的独立配置，全量分流                     |
| [MeowConfigLite.yaml](Config/MeowConfigLite.yaml) | 使用订阅提供者的独立配置，常用服务分流                 |

脚本与独立配置选择一种使用。

## 覆写脚本

在 Nyanpasu 中选择 Meow 内核，将以下链接或完整代码导入为 JavaScript 覆写：

```text
https://raw.githubusercontent.com/TheSixPasserby/MyClash/main/MeowScript.js
```

输入配置需要包含 `proxies` 节点。脚本支持节点名称整理、国旗补全、地区与倍率分组、服务分流、私有 DNS 和 hosts 处理。自建节点填写在 `customizeProxies` 中。

在 `ruleOptionsEnable` 中开关服务组、自动选择、倍率分组、极简模式和国外 QUIC 屏蔽。在 `meowOptions` 中设置：

| 选项                   | 默认值            | 说明                                                                                                   |
| ---------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| `localDNS`             | `['192.168.1.1']` | 内网域名使用的 DNS，按当前路由器或局域网修改                                                           |
| `ipv6`                 | `false`           | 是否启用 IPv6                                                                                          |
| `tunAutoRoute`         | `null`            | 沿用输入配置与客户端设置；`true` / `'global'` 全局接管，`'fake-ip'` 仅接管 Fake-IP，`false` 不添加路由 |
| `directConnectTimeout` | `2`               | 单个直连地址的连接超时，单位为秒                                                                       |

关闭客户端额外的 DNS 覆写，使生成的 DNS 与分流策略一同生效。更换网络后，重新核对 `localDNS`。

## 独立配置

根据需要选择全量版或精简版：

```text
https://raw.githubusercontent.com/TheSixPasserby/MyClash/main/Config/MeowConfig.yaml
https://raw.githubusercontent.com/TheSixPasserby/MyClash/main/Config/MeowConfigLite.yaml
```

1. 将 `proxy-providers.provider1.url` 填为机场提供的普通 Clash YAML 订阅链接。
2. 将内网 DNS `192.168.1.1` 改为当前网络实际可用的地址。
3. 作为独立配置导入客户端。

添加订阅时，复制 `provider1`，修改名称、`url` 和缓存 `path`。不同订阅的节点名需要唯一；使用未加密的兼容订阅。自定义节点可通过 `file` 类型的提供者引入，以参与地区和倍率过滤。

地区组固定，没有匹配节点的组会连接失败。节点域名通过 `proxy-server-nameserver` 解析；机场依赖私有 DNS 或特殊 hosts 映射时，需要手动补充。含 `proxy-providers` 的配置应直接使用，不再叠加覆写脚本。

## DNS 与连接策略

- 国内 DNS 使用直连 DoT；国外 DNS 使用 `?proxy=默认代理` 发送 DoH 查询，代理出口至 DNS 服务之间同样加密。DoH/DoT 连接由内核自动复用。
- 国内媒体域名提前直连；直连使用内置 `DIRECT`，单个地址超时后尝试下一地址。
- Fake-IP 排除名单内置于脚本和配置，随文件更新；路由规则集定时在线更新。
- 默认关闭 IPv6；脚本沿用输入配置的 TUN 设置，独立配置默认关闭 TUN。启用后 `auto-route: true` 在 Windows、Linux、macOS 上接管全部默认路由流量及 DNS；仅需 Fake-IP 路由时改为 `'fake-ip'`。
- 负载均衡使用 `consistent-hashing`；策略组初次选择采用候选列表首项，后续选择由内核记忆。
- 周期测速由自动选择、负载均衡策略组执行。
- 订阅的节点 hosts 与 DNS 规则按最具体的域名选择，并忽略大小写、首尾空格和末尾的根域点；DNS 的逗号分隔域名键会分别处理，同一匹配位置按后写覆盖。节点解析展开为精确策略并置于规则集 DNS 策略之前，剥去订阅 DNS 中的代理路由参数，避免依赖代理本身。
- Epic Games 不再整站强制直连，国内游戏下载域名仍由 `games_cn` 分流，其余按正常规则选择代理。

Hysteria2 的 `obfs: gecko` 及包大小参数会随节点原样保留；使用这类节点需 `76f3aa5` 或更新内核，且服务端也支持 Gecko。

## 来源与许可

脚本、配置及图标基于 [AIsouler/MyClash](https://github.com/AIsouler/MyClash) 调整，保留 [MIT 许可证](LICENSE)。规则数据主要来自 [appshubcc/bett-rules](https://github.com/appshubcc/bett-rules)，图标沿用现有 CDN 地址。
