# Meow 维护约定

## 维护范围

- 发布入口为根目录 `MeowScript.js`、`Config/MeowConfig.yaml` 和 `Config/MeowConfigLite.yaml`。
- 仓库只维护 Meow。说明和注释应描述当前用途、参数与实际限制，不保留其他内核的下载入口或迁移对照。
- `Icons/` 为图标及参考源，`Rules/` 为通用规则资源。保留来源归属和 `LICENSE`。
- 功能更新需要审查 Meow 支持情况，保留必要的 DNS、直连、正则、分组和 QUIC 处理。

## 脚本与配置

- 保持客户端入口 `main(config)` 和 ES2020 语法兼容；脚本不依赖 Node.js API。
- 脚本接收含 `proxies` 的机场配置；独立 YAML 使用 `proxy-providers`，两种入口不叠加。
- 内网 DNS 必须使用实际可达地址。节点域名需能在代理连接建立前解析，避免 DNS 与代理互相依赖。
- Fake-IP 域名快照同时存在于脚本和两份 YAML；更新时保持内容一致，精简版不含 FCM 专用名单。
- 保留用户选择的 TUN 状态和路由方式。配置默认值、订阅填写方法及网络要求应在 README 中说明。
- Discord 原生 UDP 的进程规则和域名规则须早于通用 QUIC 屏蔽；保留全局 TUN、UDP 节点及可选专用浏览器进程的说明。
- 规则集 URL 中的目录名称不代表内核限制；不要因路径包含其他内核名称而改坏有效的 MRS 数据源。

## 图标

- 未经用户明确要求，不改图标几何、渐变、命名或现有变换。
- 文件位于 `Icons/svg/<Name>.svg` 与 `Icons/png/<Name>.png`，采用 PascalCase 同名对应。
- SVG 使用 1024 × 1024 画布。保持现有等比归一化、居中、渐变和 Flutter 兼容结构。
- 保留既有特例：OpenAI 的非等比外层变换；Microsoft、EHentai、PikPak、Static、Home 的指定缩放。
- 不自动扩展形状缩放名单；国旗、圆形图案和字形不因形状推断调整。
- 既有图标 CDN 前缀保持 `https://cdn.jsdmirror.com/gh/AIsouler/MyClash@main/Icons/svg/`；新增 Discord 图标使用本仓库对应路径，不改动其他图标的来源。
- 修改引用时，核对大小写及目标文件存在，避免引入失效链接。

## 校验与收尾

- 注释清理应保持 JavaScript 的可执行结构及 YAML 解析结果不变。
- 脚本至少执行 `node --check MeowScript.js`；配置变更使用 Meow 的 `-t` 模式校验，静态配置需先填写订阅或准备校验用缓存。
- 检查 README 本地链接、图标引用和工作流中的文件路径。
- 校验工具、依赖和中间文件放在仓库外，完成后清理；不要恢复已移除的截图和测试目录。
- 提交前运行 `git diff --check`，保留文件原有换行风格，避免无关格式化。
