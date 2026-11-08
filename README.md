# MyClash · Meow

用于 [meow](https://github.com/meow-rs/meow-rs) 内核的覆写脚本与配置文件，可在 Clash Nyanpasu 中使用。

配置要求 `meow 0.29.0` 或更新版本，使用独立的直连 DNS。已核对 Meow 源码至 `7e68fb0`；上游脚本逻辑同步至 `633f54c`。

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

输入配置需要包含 `proxies` 节点。脚本支持节点名称整理、国旗补全、地区、倍率与家宽分组、服务分流、私有 DNS 和 hosts 处理。自建节点填写在 `customizeProxies` 中；密码等字符串使用引号包裹，尤其是纯数字密码。

在 `ruleOptionsEnable` 中开关服务组、自动选择、倍率分组及链式代理。开关名跟随上游：`极简国内外分流模式`、`生成高低倍率组`、`屏蔽代理QUIC流量`（默认关闭）；使用自定义开关配置时同步更新旧名称。在 `meowOptions` 中设置：

| 选项                    | 默认值            | 说明                                                                                                   |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| `localDNS`              | `['192.168.1.1']` | 内网域名使用的 DNS，按当前路由器或局域网修改                                                           |
| `ipv6`                  | `false`           | 是否启用 IPv6                                                                                          |
| `tunAutoRoute`          | `null`            | 沿用输入配置与客户端设置；`true` / `'global'` 全局接管，`'fake-ip'` 仅接管 Fake-IP，`false` 不添加路由 |
| `directConnectTimeout`  | `2`               | 单个直连地址的连接超时，单位为秒                                                                       |
| `discordVoiceProcesses` | `[]`              | 可选的 Discord 专用浏览器进程名，其全部 UDP 流量会交给 Discord 组                                      |

关闭客户端额外的 DNS 覆写，使生成的 DNS 与分流策略一同生效。更换网络后，重新核对 `localDNS`。

`链式代理` 默认关闭。开启前在 `customizeProxies` 填写落地节点；生成的“链式落地”经“链式中转”所选订阅节点连接，普通与极简模式均可使用。未填写落地节点时会提示错误；中转组仅含过滤后的订阅节点，避免引用自身。

输入配置中的 `traffic-ledger`、`tcp-keepalive`、`tcp-keepalive-idle`、`tcp-keepalive-interval`、`tcp-keepalive-probes`、`tcp-idle-timeout` 会原样保留。Meow 0.29 的 full 构建默认保存按域名、应用、节点和接口汇总的流量统计，保留 62 天；可设置 `traffic-ledger: { enable: false }` 关闭。TCP 空闲超时默认不启用，按需设置，避免提前断开长时间空闲连接。

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

- 主 DNS 使用 `?proxy=默认代理` 发送 DoH 查询；直连目标通过 `direct-nameserver` 使用国内 DoT，并开启 `direct-nameserver-follow-policy`，使私有域名及节点专用策略继续生效。DoH/DoT 连接由内核自动复用。
- 国内媒体域名提前直连；直连使用内置 `DIRECT`，单个地址超时后尝试下一地址。
- Fake-IP 排除名单使用完整 `cn` 数据，三份入口同步内置 2026-11-08 快照。Meow 尚不支持在此字段引用规则集，因此文件含十万余条域名；名单随文件更新，路由规则集独立在线更新。
- 默认关闭 IPv6；脚本沿用输入配置的 TUN 设置，独立配置默认关闭 TUN。启用后 `auto-route: true` 在 Windows、Linux、macOS 上接管全部默认路由流量及 DNS；仅需 Fake-IP 路由时改为 `'fake-ip'`。
- 负载均衡使用 `consistent-hashing`；策略组初次选择采用候选列表首项，后续选择由内核记忆。
- 周期测速由自动选择、负载均衡策略组执行；独立配置关闭 provider 的重复探测，兼容新版 Alpha 新增的 provider 定时测速。
- 脚本过滤订阅中已知的公共 DNS，保留机场私有 DNS 的适配逻辑；公共 DNS 识别范围包含 DNSPod、114DNS、OneDNS 及教育网 DNS 等。
- 订阅的节点 hosts 与 DNS 规则按最具体的域名选择，并忽略大小写、首尾空格和末尾的根域点；两者同一匹配位置均按后写覆盖，DNS 的逗号分隔域名键会分别处理。节点解析展开为精确策略并置于规则集 DNS 策略之前，剥去订阅 DNS 中的代理路由参数，避免依赖代理本身。
- Epic Games 不再整站强制直连，国内游戏下载域名仍由 `games_cn` 分流，其余按正常规则选择代理。
- 群晖域名直连；Claude 的第三方组件随 AI 分流。服务域名和 `geolocation-!cn` 规则先于服务 IP 规则，后者允许解析域名后匹配。Emby 使用 bett-rules 的 `category-emby` 规则集及域名补充。
- QUIC 屏蔽默认关闭。脚本开启 `屏蔽代理QUIC流量`，或独立 YAML 取消对应 `SUB-RULE` 行的注释后，按 `cn` 域名与国内 IP 放行，其余 UDP 443 拒绝；Discord 优先规则仍位于其前。

节点 DNS 地址中的代理参数会剥离，避免节点解析依赖代理本身；合法的加密 DNS `#SNI` 与其他查询参数会保留。`quic://` 的参数同样规范化，但 DoQ/DoH3 仍需支持该功能的新版 Alpha 与相应构建，默认继续使用 DoH/DoT。

Hysteria2 的 `obfs: gecko` 及包大小参数会随节点原样保留，服务端也需支持 Gecko。[Meow 0.28.0](https://github.com/meow-rs/meow-rs/releases/tag/v0.28.0) 已包含 Hysteria2 UDP 接收缓冲与批量收包、REALITY 和 shadow-tls 的性能改进，升级内核即可生效。

Meow 0.28.0 的 Shadowsocks `v2ray-plugin` 默认启用 `mux`；服务端使用 `mux=0` 时，需在节点的 `plugin-opts` 中显式设置 `mux: false`。脚本保留节点中的插件与 `mux` 参数，独立配置沿用订阅提供者中的节点设置。

## Discord

三个入口默认提供 `Discord` 分流组。域名规则集覆盖官网、登录与聊天 API、客户端更新、CDN、附件及媒体；本机原生客户端另有进程规则，接管语音、视频和屏幕共享中直接连接 IP 的流量。这些规则位于通用 UDP 443 屏蔽之前。

原生客户端语音需启用 **TUN 全局路由**（`auto-route: true` / `'global'`），并在 Discord 组选择支持 UDP 的节点。系统 HTTP 代理不接管语音 UDP；`'fake-ip'` 路由范围也覆盖不到信令直接下发的真实 IP。HTTP 延迟测速成功不能证明节点的 UDP 可用。进程识别用于本机，局域网其他设备的流量不能按本机 Discord 进程归类。

[Meow 0.29.0](https://github.com/meow-rs/meow-rs/releases/tag/v0.29.0) 已修复全局 TUN 下的回环 UDP 连接和双栈监听的 IPv4 进程识别，无需额外参数。

浏览器的聊天、更新和附件按域名分流；浏览器直接 IP 的 WebRTC 语音无法仅凭域名精确识别。需要语音固定走 Discord 组时，可使用专用浏览器，在脚本的 `discordVoiceProcesses` 中填写其进程名，例如 `['firefox.exe']`；独立 YAML 在 Discord 规则段提供对应注释示例。该进程的全部 UDP 都会交给 Discord 组，同样需要全局 TUN 和支持 UDP 的节点。

脚本可通过 `ruleOptionsEnable.Discord` 关闭此分流。极简模式沿用上游的精简分组方式，Discord 规则改为指向“默认代理”，保留语音和 UDP 443 的优先分流。

## 来源与许可

脚本、配置及图标基于 [AIsouler/MyClash](https://github.com/AIsouler/MyClash) 调整，保留 [MIT 许可证](LICENSE)。规则数据主要来自 [appshubcc/bett-rules](https://github.com/appshubcc/bett-rules)，现有图标沿用原 CDN 地址。

新增 [Discord.svg](Icons/svg/Discord.svg) 与配套 PNG 使用 [Discord 官方品牌素材](https://discord.com/branding)的 [Clyde SVG](https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/66e3d80db9971f10a9757c99_Symbol.svg)，保留官方形状与 Blurple 配色，等比居中至 1024 × 1024；标志权属 Discord。该图标由本仓库提供。
