'use strict';

/**
 * 待测试/验证的脚本及差异元信息（单一来源）。
 * run-tests.js（Node 测试）、es2020-check.js、quickjs-check.js 共用，
 * 避免脚本列表在多处重复维护导致不同步。
 */
const SCRIPTS = [
  {
    file: 'Script/Script.js',
    label: '精简版 Script.js',
    meta: {
      full: false,
      regions: ['香港', '日本', '美国', '新加坡'],
    },
  },
  {
    file: 'Script/mihomoScript.js',
    label: '全量版 mihomoScript.js',
    meta: {
      full: true,
      regions: ['香港', '日本', '美国', '新加坡', '台湾'],
    },
  },
];

// Meow 使用独立回归套件，避免套用 Mihomo 专属 DNS、直连节点等断言。
const MEOW_SCRIPT = 'MeowScript.js';

/** 脚本文件路径列表（供兼容性检查模块使用，包含 Meow） */
const SCRIPT_FILES = [...SCRIPTS.map((s) => s.file), MEOW_SCRIPT];

module.exports = { SCRIPTS, MEOW_SCRIPT, SCRIPT_FILES };
