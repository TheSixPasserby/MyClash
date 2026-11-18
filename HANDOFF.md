# MyClash · Meow 维护交接

更新日期为 2026-11-19。本轮基于 `origin/main`（`06fb669`，含格式化提交；前一功能基线 `cec9470`），直接面向 **Meow nightly（`v0.29.0-alpha+23cf184`）**，不再保留 `0.29.0` 稳定版回退。下文的版本、功能审查和验证结果均对应当前工作区状态。 [前基线提交](https://github.com/TheSixPasserby/MyClash/commit/06fb6695f4782f1d5aa78c6170102dfdebc08acd)

## 从哪里接手

| 文件                                              | 用途                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [MeowScript.js](MeowScript.js)                    | Nyanpasu 的 JavaScript 覆写，接收含 `proxies` 的订阅。入口为 `main(config)`，运行时使用 ES2020，保持无 Node.js 依赖。                                                          |
| [MihomoAddon.js](MihomoAddon.js)                  | 追加到原作者 Mihomo 脚本之后的独立覆写，负责 Discord 与 NeoSek 策略组及规则排序。                                                                                              |
| [MeowConfig.yaml](Config/MeowConfig.yaml)         | 独立全量配置，通过 `proxy-providers` 加载订阅。                                                                                                                                |
| [MeowConfigLite.yaml](Config/MeowConfigLite.yaml) | 独立精简配置，保留常用服务和 Discord，省略 FCM 专用名单。                                                                                                                      |
| [README.md](README.md) · [AGENT.md](AGENT.md)     | 前者面向使用者，后者记录仓库维护约定，尤其是发布范围、图片资产和校验要求。                                                                                                     |
| [format.yaml](.github/workflows/format.yaml)      | GitHub Actions 工作流，使用 Node 24 对 `MeowScript.js` 与 `MihomoAddon.js` 做语法检查。Meow 原生校验在本地执行。主分支推送或手动触发时，工作流可用 Prettier 格式化并追加提交。 |

脚本和独立 YAML 二选一。脚本会拒绝含非空 `proxy-providers` 的输入。使用独立 YAML 时填写 `proxy-providers.provider1.url`，添加其他订阅时为每个提供者设置唯一名称和缓存路径，并保证节点名不重叠。`192.168.1.1` 是内网 DNS 示例，使用时应替换为当前网络实际可达的服务器。仓库发布 Meow 与 Mihomo 附加入口，沿用上游署名和 [MIT 许可证](LICENSE)。

## 同步上游

| 来源     | 本次基线                                                                                                                                             | 核对内容                                                                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 原脚本   | [`AIsouler/MyClash@858e336`](https://github.com/AIsouler/MyClash/commit/858e336f91ef5bdea9df9fe8d80d69e172b49364)                                    | 已核对 `633f54c..858e336`：AdBlock/IP 规则顺序、`select` 置前、`douyin` 规则集 DNS、`shouldRewriteByHosts` 自监听放宽、移除 `Emby` 冗杂域名与冗余 YAML 容器键（Concord 内核专属提交不适用）。 |
| 内核     | [Meow `Prerelease-Alpha` (`23cf184`)](https://github.com/meow-rs/meow-rs/commit/23cf18449bd1696870f3c07487af020472b476e7)                            | 直接面向 Nightly：审查 `raw.rs`、`validation.rs`、`dns_parser.rs`、`rule_ir.rs`、`resolver.rs` 及测试集，按实际解析/运行时语义适配且清除已知警告。                                            |
| 规则数据 | [`bett-rules@f9a7499`](https://github.com/appshubcc/bett-rules/tree/f9a7499d29269be08b6bf1411d0efccf4a913ea1/geo/geosite)（`meta`，2026-11-18 快照） | `private.list`、`fakeip-filter.list`、`cn.list`、`googlefcm.list`。                                                                                                                           |

1. 从表中的基线对比上游改动，同时检查本仓库 `main` 与 `origin/main` 的关系。`origin` 指向 `TheSixPasserby/MyClash`。本地遗留的 `upstream/main` 引用仍停在 `bf6c2db`，同步进度以 README 记录的已移植提交为准。
2. 将原脚本的逻辑移植到 Meow 入口。确认内核支持的字段与规则含义，分别核对 JavaScript 与 YAML，避免把其他内核的脚本、配置、测试目录或截图带回发布树。
3. 更新时保留节点参数、用户 TUN 设置、DNS 引导和规则顺序。影响默认行为或 Nightly 适配的变更写进 README。保留既有图标几何、命名与大小写，检查图标和规则集 URL。
4. 验证通过后更新 README 中的上游提交和内核审查点，再按授权提交和推送。推送后留意格式工作流可能追加的 `chore: format Meow files` 提交。

## 容易改出回归的地方

- **DNS 与节点引导。** 主 DNS 是经“默认代理”的 DoH（Nightly `full` 构建自动协商 HTTP/2 并复用连接；切勿开启 `prefer-h3: true`，否则带 `?proxy=` 的域名上游会被 `reject_proxied_quic_hostname` 拒绝）。`DIRECT` 使用国内 DoT，开启 `direct-nameserver-follow-policy: true` 与 `nameserver-policy-exclusive: true`（脚本支持布尔覆盖，默认 `true`），且默认启用 `dns.use-system-hosts: true`。脚本无条件生成 `dns.proxy-server-nameserver` 与去 `#DIRECT` 的 `dns.proxy-server-nameserver-policy`，并在 `nameserver-policy` 中保持域名块位于所有 `rule-set:` 之前。开启 `ipv6` 时才输出 `dns.fake-ip-range6`（默认 `'fdfe:dcba:9877::/64'`），避免在纯 IPv4 下触发告警。`createDomainEntryFinder` 和 `createDomainMatcher` 用预编译索引保留大小写、尾点和空格规范化、具体标签优先及同位置后写覆盖的行为。
- **Fake-IP 快照。** Nightly 的 `fake-ip-filter` 仍不支持 `rule-set:`，三份入口各自内置快照。当前快照源自 `bett-rules@f9a7499`（2026-11-18）：转小写并排序去重后，私有 132、兼容 121（含 `mijia cloud` 与 `+.pub.3gppnetwork.org`）、国内 107,455、FCM 12；全量去重后 107,706，精简版 107,694。脚本的极简模式和关闭 FCM 的模式省略 FCM，并按实际节点追加域名。
- **规则与 QUIC。** 顺序是 AdBlock、私有及国内域名直连、Discord 优先规则、可选 QUIC 屏蔽、服务与国外域名规则、`geolocation-!cn`、国内与私有 IP 规则、服务 IP 规则，最后 `MATCH`。QUIC 默认关闭；开启时直接利用 Nightly 逻辑规则内嵌 `RULE-SET`：`AND,((NETWORK,UDP),(DST-PORT,443),(NOT,((OR,((RULE-SET,cn),(RULE-SET,cn_ip,no-resolve),(RULE-SET,private_ip,no-resolve)))))),REJECT`，不再生成或维护 `sub-rules`。
- **Nightly 全局、TUN、嗅探与节点参数。** 入口默认设置 `unified-delay: true`；脚本去掉 `meowOptions.nightly` 开关，新增 `meowOptions.tunStack`（支持 `'system'`/`'mixed'`/`'lwip'`，剔除会触发告警的 `'gvisor'`/`'mips'`）与上游同步的 `ruleOptionsEnable.代理IPV4优先` / `代理IPV6优先`（`getIpVersionPreference`，两者同开时不生效，IPv6 优先仅在 `meowOptions.ipv6: true` 时下发 `'ipv6-prefer'`），并继承 `traffic-ledger`、`tcp-keepalive*`、`tcp-idle-timeout`、`global-client-fingerprint`、`global-ua`、`interface-name`、`routing-mark`、`max-connections`、`connection-notes`、`logbook` 及过滤后的 `sniffer`（仅保留 `TLS`/`HTTP`/`QUIC` 协议的 `ports`，忽略 `force-dns-mapping` 及协议内未知键）。节点通过 `sanitizeProxyIpVersion` 保留受支持的逐节点 `ip-version`（未启用 `ipv6` 时剔除 `ipv6` / `ipv6-prefer`），同时保留 `tfo`、`mptcp`、`dialer-proxy`、`wireguard` 等 Nightly 能力。独立 YAML 移除 `&proxy_providers_common` 中的禁用 `health-check` 块以消除 Nightly 告警。

## 验证与排障

配置变更后，从仓库根目录运行语法和差异检查。

```bash
node --check MeowScript.js
node --check MihomoAddon.js
git diff --check
```

用临时目录存放校验配置和本地样例，避免与正在运行的 Nyanpasu 共用内核目录。脚本用少量虚拟节点调用 `main(config)` 生成配置。两份 YAML 保留原有锚点、合并键与正则，用本地样例替换空订阅和在线规则集（可直接复制 `bett-rules@meta` 的真实 `.mrs` 文件至 `./ruleset/`），规则集样例应保持各自的 `behavior`。需要严格校验时，在测试配置顶层设置 `strict: true`，再用 `meow -d "<临时目录>" -f "<校验配置>" -t`。覆盖默认与极简模式、`代理IPV4优先`/`代理IPV6优先` 开关、IPv6 与 TUN 栈、Discord 与 QUIC 开关、链式代理、hosts 改写、`proxy-providers` 拦截、ES2020/QuickJS 引擎兼容及 `MihomoAddon.js` 串联输出。完成后清理临时目录和工具。

本轮验证结果（Node `v24.21.0` + `espree` ES2020 + `quickjs-emscripten` + `meow 0.29.0-alpha+23cf184`，全部开启 `strict: true` 与真实 `bett-rules@f9a7499` `.mrs` 规则集）：

- `node --check MeowScript.js`、`node --check MihomoAddon.js`、`espree` 严格 ES2020 语法解析、`QuickJS` 实机 `main()` 执行，以及链接与 `Icons/` 大小写核对全部通过。
- `MeowConfig.yaml` 与 `MeowConfigLite.yaml` 的默认配置及全部 Nightly 注释项（含 `global-client-fingerprint`、`global-ua`、`tun.stack: system`、`sniffer` 与 `AND` QUIC 规则）开启配置共 4 组均通过 `meow -t`，零警告零错误。
- `MeowScript.js` 10 组场景（`default`、`ip-version-v4-prefer`、`ip-version-v6-prefer`、`ip-version-v6-guarded`、`ip-version-both-enabled`、`ipv6-tun`、`quic-discord`、`minimal`、`chain-proxy`、`hosts-rewrite`）全部通过 `meow -t`（仅 `ipv6-tun` 的 `tun.stack: mixed` 在 Linux 触发内核预期提示 `mixed is system here`，其余零警告）；`proxy-providers` 输入拦截抛出预期错误。
- `mihomoScript.js`（开启 QUIC 屏蔽）串联 `MihomoAddon.js` 校验通过，`Discord` 与 `NeoSek` 策略组及规则均早于 `AND` QUIC 规则与 `MATCH`。
- 注：本轮检验了静态/配置编译与 JS 引擎兼容校验；真实机场订阅连通性、DoH/DoT 远端解析及 TUN/Discord 实机转发仍需在运行环境实测。

| 现象                                    | 优先排查                                                                                                                                                                                                                                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 载入覆写后节点全部超时                  | 先确认同一订阅在原配置下能用，再看 Meow 启动日志、Nyanpasu 最终运行配置及节点精确 DNS 策略。若报 `rule-set:private` 无可用 DNS，确认填写了 Meow 支持且本机可达的局域网解析器。                                                                                                                              |
| Discord 聊天正常，语音绕过分流          | 确认启用了 TUN 全局路由、内核处于规则模式、所选节点支持 UDP，再核对本机进程识别。浏览器直接 IP 的 WebRTC 需要专用浏览器进程规则，该进程的全部 UDP 都会进入 Discord 组。ProxyLane 转发会丢失原始进程身份，专用入口方案已按要求回退。                                                                         |
| TUN 关闭后以太网 DNS 仍显示 `127.0.0.1` | 在客户端关闭完成后记录活动网卡的 DNS、内核 PID/日志和客户端服务版本，区分延迟恢复与持续残留。历史上同一主机追加的 10 轮测试均恢复，仍需以现场复现为准。 [相关客户端问题](https://github.com/libnyanpasu/clash-nyanpasu/issues/5883) · [客户端修复](https://github.com/libnyanpasu/clash-nyanpasu/pull/5916) |
| Bilibili 直播礼物列表异常               | 历史案例已定位到 Chrome 时区修改扩展。先用干净浏览器环境复测，再看失败资源的 URL、状态和实际分流。                                                                                                                                                                                                          |

历史校验记录存于工作机的 `C:\Users\thesi\Documents\Codex\diagnostics\upstream-20261108`，Windows TUN DNS 复测记录在同级 `meow-dns-20261025`。共享排障材料时只带必要的错误、版本和复现步骤，移除订阅 URL、节点凭据和控制器密钥。
