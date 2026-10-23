# MyClash · Meow

面向 [meow](https://github.com/meow-rs/meow-rs) 内核的 JavaScript 覆写脚本与配置文件，主要用于 Clash Nyanpasu。本仓库基于 [AIsouler/MyClash](https://github.com/AIsouler/MyClash) 适配，现只维护 Meow 版本。

## 选择入口

| 文件 | 用途 |
| --- | --- |
| [MeowScript.js](MeowScript.js) | 覆写机场配置，动态整理节点、生成地区和服务分流组 |
| [MeowConfig.yaml](Config/MeowConfig.yaml) | 独立配置，全量服务分流，使用 `proxy-providers` 加载订阅 |
| [MeowConfigLite.yaml](Config/MeowConfigLite.yaml) | 独立配置，保留常用服务分流，使用 `proxy-providers` 加载订阅 |

脚本只提供一个维护入口，可在 `ruleOptionsEnable` 中开关服务组、地区自动选择、倍率分组、极简模式和国外 QUIC 屏蔽。静态配置保留全量版与精简版的分流差异。

## 覆写脚本

在 Nyanpasu 中选用 Meow 内核，再将以下链接或完整代码作为 JavaScript 覆写导入：

```text
https://raw.githubusercontent.com/TheSixPasserby/MyClash/main/MeowScript.js
```

脚本用于机场提供的、含 `proxies` 节点的配置。它会过滤信息节点、整理名称与国旗、按地区和倍率分组，并处理节点域名的私有 DNS、hosts 映射及 `dialer-proxy` 引用。自建节点可填写在 `customizeProxies` 中。

使用时关闭客户端额外的 DNS 覆写，使脚本生成的 DNS 与分流策略一同生效。`meowOptions.localDNS` 默认是 `192.168.1.1`；使用前按实际路由器或内网 DNS 修改，换网络后也需要核对。

脚本会拒绝含 `proxy-providers` 的输入。需要直接管理一个或多个订阅提供者时，使用下面的独立配置，不要叠加脚本。

## 独立配置

选择一份配置，将 `proxy-providers.provider1.url` 填为机场提供的普通 Clash YAML 订阅链接，再作为配置导入 Nyanpasu：

```text
https://raw.githubusercontent.com/TheSixPasserby/MyClash/main/Config/MeowConfig.yaml
https://raw.githubusercontent.com/TheSixPasserby/MyClash/main/Config/MeowConfigLite.yaml
```

添加其他订阅时，复制 `provider1`，修改提供者名称、`url` 与缓存 `path`。自定义节点建议使用 `file` 类型的提供者，以参与地区和倍率过滤。

两份配置中的地区组是固定的；没有匹配节点的组会连接失败，不会回退直连。节点域名统一通过 `proxy-server-nameserver` 解析；机场如果依赖私有 DNS 或特殊 hosts 映射，需要手动补充。内网域名使用的 `192.168.1.1` 也应改为本机网络实际可用的内网 DNS。

## 适配行为

当前内核验证基线为 **meow 0.26.1-alpha+33ec533**。Meow 与上游脚本所用内核的配置能力存在差异，当前适配包括：

- 国内域名使用直连 DoT，国外 DNS 通过“默认代理”发送 TCP 查询；代理出口到 DNS 服务之间的这一段 TCP 查询未加密。
- 直连组使用内置 `DIRECT`，国内媒体域名提前直连，避免先按 IP 分流而限制 CDN 候选地址。`tcp-connect-timeout` 限制单个直连地址的等待时间，不提供并发拨号。
- Fake-IP 排除名单使用域名展开快照。路由规则集仍可在线更新，排除快照随脚本或配置版本更新。
- 默认关闭 IPv6。脚本沿用输入配置和客户端的 TUN 设置；两份独立配置默认关闭 TUN，可按需在客户端启用，不强制实验性全局路由。
- 不提供节点级 IPv4 / IPv6 优先选项。负载均衡改用 `consistent-hashing`，默认策略通过候选列表首项实现，QUIC 判断使用子规则。
- 提供者周期测速由自动选择等策略组承担。Meow 暂无原订阅的 `age-secret-key` 解密和 `additional-prefix` 改名功能；应使用未加密的兼容订阅，并由订阅源或转换器保证不同订阅的节点名唯一。

## 维护与上游同步

2026-10-23 已核对上游 [c1de5acd](https://github.com/AIsouler/MyClash/commit/c1de5acd1dfe7d29eb5af00084e8d93e3b9610c4)（2026-10-22）：JavaScript 脚本自 [0c7a93a](https://github.com/AIsouler/MyClash/commit/0c7a93a) 后没有变化，当前 Meow 脚本已包含该版本的功能更新。

同时同步了上游 YAML 的 `exclude-type` 与锚点修复，并将 Fake-IP 域名快照刷新至规则数据提交 [9e007926](https://github.com/appshubcc/bett-rules/commit/9e0079263d933a23c7b0a7dc1c24b604298648e2)（2026-10-23）。此次新增 `localhost.weixin.qq.com`、`localhost.work.weixin.qq.com`、`+.szu.app`、`+.szu.moe`，没有删除条目。

本仓库只保留 Meow 的发布、配置和测试入口。同步时先审查 [上游](https://github.com/AIsouler/MyClash) 差异，再将适用功能移入 `MeowScript.js`，更新相应配置和回归测试，并记录同步的上游提交。

不要用上游原文件直接覆盖 Meow 入口；DNS、直连、正则、分组和 QUIC 等兼容替代需要保留。上游脚本只用于比较，不作为本仓库下载或测试目标。

在仓库根目录运行：

```bash
npm --prefix Test ci
node Test/run-tests.js
```

完整测试说明见 [Test/README.md](Test/README.md)。模拟订阅和配置检查不能代替目标内核的实际启动与联网验证。

## 来源与致谢

原始脚本、配置及图标来自 [AIsouler/MyClash](https://github.com/AIsouler/MyClash)，原作者为 AIsouler；保留原项目的 [MIT 许可证](LICENSE)。现有图标 CDN 地址按原项目约定保留。

感谢原项目及其上游：

- [dahaha-365/YaNet](https://github.com/dahaha-365/YaNet)
- [YiXuanZX/rules](https://github.com/YiXuanZX/rules)
- [appshubcc/bett-rules](https://github.com/appshubcc/bett-rules)
- [Koolson/Qure](https://github.com/Koolson/Qure)
- [jsdmirror/JSDMirror](https://github.com/jsdmirror/JSDMirror)
