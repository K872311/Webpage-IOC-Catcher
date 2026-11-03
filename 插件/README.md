# IOC 情报采集器

浏览网页时一键提取威胁情报 IOC（域名、IP、哈希），支持分类筛选、复制与导出下载。

兼容 **Chrome** / **Edge**（Manifest V3）。当前版本 **1.4.3**。

## 功能

- **扫描当前页**：正文、链接、表格、Shadow DOM、同源 iframe 合并提取
- **支持类型**：domain / IPv4 / IPv6 / MD5 / SHA1 / SHA256（不采集完整 URL / 邮箱 / CVE）
- **Defang 还原**：`hxxp`、`[.]`、`(.)`、`dot`、全角点等
- **精确 / 全部模式**：默认精确（高置信字段/标签）；全部含全文正则
- **平台适配**：Hunt.io、VirusTotal、OTX、abuse.ch、奇安信分节、Breakglass 分节等
- **右键 / 快捷键**：页面右键扫描；选中文本提取；`Alt+Shift+I` 扫描当前页
- **导出**：JSON / CSV / TXT / STIX 2.1 / MISP
- **选项页**：默认模式、额外噪音域名、是否扫 iframe、空结果重试

## 安装

1. 打开 Chrome 或 Edge，进入扩展管理页：
   - Chrome：`chrome://extensions/`
   - Edge：`edge://extensions/`
2. 打开右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择本目录（包含 `manifest.json` 的文件夹）

## 使用

1. 打开任意普通网页（或本仓库 `demo/` 测试页）
2. 点击浏览器工具栏中的扩展图标
3. 点击 **扫描**（或 `Alt+Shift+I`）
4. 在列表中筛选 / 搜索 / 单条复制
5. 选择格式后点击 **导出**

选项：扩展详情 → **扩展程序选项**，或弹窗右上角 ⚙。

## 目录结构

```
插件/
├── manifest.json
├── README.md
├── icons/
├── demo/
│   ├── sample-iocs.html
│   └── qianxin-ioc-sample.html
├── scripts/
│   └── test-qianxin-extract.mjs
└── src/
    ├── background/          # service worker + 注入提取
    ├── popup/               # 弹窗 UI
    ├── options/             # 选项页
    └── shared/              # 消息、导出、偏好
```

## 权限说明

| 权限 | 用途 |
|------|------|
| `activeTab` | 读取当前标签页以便扫描 |
| `scripting` | 向当前页（及同源 iframe）注入提取脚本 |
| `storage` | 会话结果 + 本地偏好 |
| `contextMenus` | 右键扫描 / 选区提取 |
| `host_permissions` | 在 http/https 页面执行扫描 |

所有数据仅保存在本地浏览器，**不会上传**。

## 更新说明

### v1.4.3
- **精确提取**：Securelist 式 `File hashes` / `Domains and IPs`；`MD5 文件名` 行；内联 `MD5:\`…\``
- 支持多级云 C2（`*.azurewebsites.net`、`*.s3.*.amazonaws.com`）；粘连域名拆分
- 收紧社交高置信（非 X 页需标签+defang 同时出现）
- 回归：`node scripts/test-securelist-extract.mjs`

### v1.4.2
- **X/Twitter 自动下拉**：扫描时滚动时间线并持续快照推文，缓解无限滚动/虚拟列表漏扫
- 选项页可开关「自动下拉加载更多推文」

### v1.4.1
- **修复 X/Twitter**：按 `tweetText` 汇总推文，不再只扫第一个 `article`
- 增强 defang：全角括号、零宽字符；`#IOC`/`#C2` 同行指标标为高置信

### v1.4.0
- **提取增强**：开放 Shadow DOM、同源多 frame 合并、空结果短重试（SPA）
- **平台链接**：VirusTotal `/gui/`、OTX indicator、abuse.ch 参数、data-* 属性、JSON-LD
- **Defang**：`dot` / 全角点 / `meow` 等
- **右键菜单** + **Alt+Shift+I** 快捷扫描；工具栏角标显示高置信数
- **导出**：STIX 2.1、MISP JSON
- **选项页**：默认模式、导出格式、额外噪音域名、iframe / 重试开关

### v1.3.5
- 内部提取与过滤规则迭代（manifest 版本对齐）

### v1.3.2
- **不再采集 URL**：仅保留 domain / IPv4 / IPv6 / MD5 / SHA1 / SHA256
- 遇到完整 URL 时只提取主机名（域名或 IP），不再收录整链
- 修复表格单元格按 `/` 拆分导致出现裸 `https` 误报

### v1.3.1
- 精确模式支持 Breakglass 分节与奇安信命名 IOC 块
- （历史）独立爬虫说明已移除出本仓库交付物

### v1.3.0
- **精确模式（默认）** / **全部模式**；来源徽章；导出增加 `confidence`

### v1.2.0
- hunti 噪音过滤；结构化表格 / Hunt 链接；正文优先

## 限制

- 无法扫描受保护页面：`chrome://`、`edge://`、扩展商店、`about:` 等
- 跨域 iframe 无法注入（浏览器隔离）；同源 iframe 可合并
- 超大页面文本会截断（约 500KB）后再提取
- 正则提取可能存在误报/漏报，导出前请人工复核

## 导出格式示例

**TXT（默认带类型）**

```
domain	evil-malware.com
ipv4	185.220.101.1
sha256	e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

**CSV 表头**：`type,value,count,source,confidence`

**STIX / MISP**：JSON 文件，可导入兼容平台（字段为简化版，导入前请按环境校验）。

## 回归测试

```bash
node scripts/test-qianxin-extract.mjs
```
