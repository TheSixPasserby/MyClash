# MyClash · Meow 测试

测试对象为根目录 `MeowScript.js` 及 `Config/MeowConfig.yaml`、`Config/MeowConfigLite.yaml`。测试不加载或依赖上游原脚本。

## 运行方式

在仓库根目录执行：

```bash
npm --prefix Test ci
node Test/run-tests.js
# 或
npm --prefix Test test
```

可按需筛选部分检查，参数可以组合：

```bash
node Test/run-tests.js --node     # Node 单元、集成、Meow 适配及配置检查
node Test/run-tests.js --es2020   # MeowScript.js 的 ES2020 兼容性检查
node Test/run-tests.js --quickjs  # MeowScript.js 的 QuickJS 引擎验证
```

`espree` 用于 ES2020 语法和内置 API 检查，`quickjs-emscripten` 用于真实 QuickJS 引擎加载及执行 `main()`，`yaml` 用于解析两份配置。完整验证前应先安装锁定的依赖；兼容性检查在依赖缺失时会跳过，不能将跳过等同于检查通过。

## 覆盖内容

- **公共函数**：域名模式匹配、不可见字符处理、国旗与节点名称、地区和倍率识别、hosts 映射、`dialer-proxy` 引用及自建节点去重。
- **脚本集成**：节点过滤、动态分组、服务选项、极简模式、全局组、自建节点组合、空订阅和无有效节点等异常。
- **Meow 适配**：DNS 和节点域名策略、内置 `DIRECT`、国内媒体前置规则、QUIC 子规则、默认候选、组引用和循环，以及不输出已知不兼容配置。
- **静态配置**：两份 Meow YAML 的语义、分组和规则引用、地区与倍率正则、DNS 及兼容字段，同时保留完整版与精简版的服务差异。
- **运行引擎**：`MeowScript.js` 的 ES2020 检查，以及 QuickJS 的顶层执行、`main()` 调用和与 Node 结果的结构对照。

## 文件结构

```text
Test/
├── package.json
├── package-lock.json
├── run-tests.js             # 唯一测试入口，支持 --node/--es2020/--quickjs
├── README.md
├── lib/
│   ├── loader.js            # vm 沙箱加载 MeowScript.js 并暴露内部符号
│   ├── config-loader.js     # 解析 Meow YAML 配置
│   ├── harness.js           # 断言输出及汇总
│   ├── fixtures.js          # 模拟订阅与节点
│   ├── scripts.js           # Meow 脚本入口的单一来源
│   ├── es2020-check.js      # ES2020 语法与内置 API 检查
│   └── quickjs-check.js     # 真实 QuickJS 加载与 main() 验证
└── suites/
    ├── unit.js              # 公共函数单元测试
    ├── integration.js       # Meow main() 集成测试
    ├── meow.js              # Meow 专用适配及极简模式回归
    └── config.js            # 两份独立配置的兼容及引用检查
```

## 说明

脚本通过 `vm` 沙箱加载，导出内部函数供测试使用，不修改发布文件。配置选项测试使用 `withOptions` 等辅助方法，在用例结束后恢复选项。

所有订阅、节点及口令使用测试数据，不应把真实订阅或凭据提交到测试目录。模拟订阅与静态检查不替代 meow 内核的实际启动、DNS 查询和联网验证；内核行为变化时，应在隔离端口、关闭 TUN 的环境中补充验证。