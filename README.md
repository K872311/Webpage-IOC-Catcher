# IOC 情报采集器

**版本：1.4.3** · 兼容 **Chrome / Edge**（Manifest V3）

---

## 项目介绍

**IOC 情报采集器** 是一款面向安全分析人员的浏览器扩展。在浏览威胁情报报告、厂商博客、社交平台 IOC 帖时，无需手工复制粘贴，即可从当前网页**自动识别并提取**域名、IP、文件哈希等 IOC，支持去重、分类筛选、批量复制与多种格式导出。

设计原则：

- **本地优先**：扫描与导出均在浏览器内完成，不上传任何数据。
- **精确优先**：默认「精确模式」，优先展示表格、分节标题、标签行等高置信 IOC，减少导航链接与正文误报。
- **贴近实战**：适配 Securelist、奇安信、Breakglass、Hunt.io、VirusTotal、X/Twitter 等常见来源的版式与 defang 写法。

适用场景：APT 报告阅读、IOC 入库前整理、快速核对 C2/样本哈希、从时间线批量采集 defang 指标等。

---

## 特性

### 提取能力

| 类别 | 说明 |
|------|------|
| **IOC 类型** | domain、IPv4、IPv6、MD5、SHA1、SHA256 |
| **不采集** | 完整 URL 链、邮箱、CVE（从 URL 中仅提取主机名/IP） |
| **Defang 还原** | `hxxp`、`[.]`、`(.)`、`dot`、全角点、零宽字符等 |
| **结构化提取** | 表格列（IP / Host / Hash）、`data-ioc`、Hunt/VT/OTX 链接、JSON-LD |
| **分节识别** | `File hashes`、`Domains and IPs`、`Indicators of compromise`、奇安信 IOC 块、Breakglass 分节等 |
| **云 C2 域名** | 多级域名如 `*.azurewebsites.net`、`*.s3.*.amazonaws.com`；表格内粘连域名自动拆分 |
| **页面覆盖** | 正文优先；开放 Shadow DOM；同源 iframe 合并；SPA 空结果短重试 |

### 精确 / 全部模式

- **精确（默认）**：高置信 IOC（字段、标签、分节内指标等）。
- **全部**：额外包含全文正则匹配，召回更高，可能有误报。
- 列表展示**来源**（字段 / 标签 / 链接 / 全文）与**置信度**，便于人工复核。

### 平台与站点

- **情报报告**：Securelist / Kaspersky 风格分节与 `MD5 文件名` 行、内联 `MD5:` 哈希。
- **中文报告**：奇安信式 `MODBEACON-MD5:`、`ghost C2:` 等命名块。
- **英文分节**：Breakglass 式 Network / Sample hashes / Panel + C2 domains 等。
- **X / Twitter**：推文 `tweetText` 汇总；扫描时**自动下拉**时间线并快照（可选项关闭）；`#IOC` / `#C2` + defang 识别。
- **第三方页面**：Hunt.io、VirusTotal GUI、OTX、abuse.ch 等链接与参数解析。

### 交互与导出

- 工具栏弹窗：扫描、搜索、类型筛选、单条复制、批量复制、清空。
- **右键菜单**：扫描本页 IOC / 从选中文本提取。
- **快捷键**：`Alt+Shift+I` 扫描当前页。
- **角标**：显示最近一次扫描的高置信数量。
- **导出**：JSON、CSV、TXT、STIX 2.1、MISP JSON（按当前筛选结果导出）。
- **选项页**：默认模式、默认导出格式、额外噪音域名、iframe 扫描、空结果重试、X 自动下拉等。

### 隐私与安全

- 数据仅存于浏览器（会话结果 + 本地偏好）。
- 不向外部服务器发送页面内容或 IOC 列表。

---

## 用法

### 安装

1. 打开扩展管理页  
   - Chrome：`chrome://extensions/`  
   - Edge：`edge://extensions/`
2. 开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择包含 `manifest.json` 的本项目文件夹

### 基本流程

1. 打开目标网页（例如威胁情报文章或 `demo/` 下测试页）
2. 点击工具栏 **IOC 情报采集器** 图标
3. 点击 **扫描**（或按 `Alt+Shift+I`）
4. 在 **精确 / 全部** 间切换，用类型芯片或搜索框过滤
5. **复制** 当前筛选结果，或选择格式后 **导出**

> 在 **X.com / Twitter** 上扫描时，扩展会自动向下滚动约 10–20 秒以加载更多推文，页面会短暂滚动，属正常现象。可在选项页关闭「自动下拉加载更多推文」。

### 右键与选区

- 在页面空白处右键 → **扫描本页 IOC**
- 选中一段含 IOC 的文字 → 右键 → **从选中文本提取**

### 选项与偏好

路径：扩展详情 → **扩展程序选项**，或弹窗右上角 **选项**。

可配置项包括：

- 默认查看模式（精确 / 全部）
- 默认导出格式
- 额外噪音域名（每行一个，匹配该域及子域并从结果排除）
- 是否扫描同源 iframe
- 空结果时短重试（适配懒加载页面）
- X/Twitter 是否自动下拉

### 本地测试页

| 文件 | 用途 |
|------|------|
| `demo/sample-iocs.html` | 通用 IOC、VT 链接、Shadow DOM |
| `demo/qianxin-ioc-sample.html` | 奇安信式分节 |
| `demo/securelist-ioc-sample.html` | Securelist 式哈希与域名列表 |

用浏览器直接打开上述 HTML，再点扩展 **扫描** 即可验证。

### 导出说明

- **JSON / CSV / TXT**：含类型、值、次数、来源、置信度（CSV/JSON）。
- **STIX 2.1 / MISP**：简化结构，导入平台前请按环境校验字段。

TXT 示例：

```
domain	evil-malware.com
ipv4	185.220.101.1
sha256	e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

CSV 表头：`type,value,count,source,confidence`

---

## 目录结构

```
插件/
├── manifest.json
├── README.md
├── icons/
├── demo/                    # 本地测试页
├── scripts/                 # Node 回归脚本
└── src/
    ├── background/          # Service Worker + 页面注入提取
    ├── popup/               # 弹窗 UI
    ├── options/             # 选项页
    └── shared/              # 消息、导出、用户偏好
```

---

## 权限说明

| 权限 | 用途 |
|------|------|
| `activeTab` | 在用户操作的标签页上扫描 |
| `scripting` | 注入提取脚本（含同源 iframe） |
| `storage` | 会话内保存最近扫描结果 + 本地偏好 |
| `contextMenus` | 右键扫描 / 选区提取 |
| `host_permissions` | 在 http/https 页面执行扫描 |

---

## 限制与注意

- 无法扫描：`chrome://`、`edge://`、扩展商店、`about:` 等受保护页面。
- **跨域 iframe** 受浏览器隔离，无法注入；**同源 iframe** 可合并。
- 超大页面正文约 **500KB** 截断后再提取。
- 全文正则可能存在误报/漏报；**导出或入库前请人工复核**。
- STIX/MISP 为通用简化格式，非各平台完整 schema。

---

## 开发者：回归测试

```bash
node scripts/test-qianxin-extract.mjs
node scripts/test-twitter-defang.mjs
node scripts/test-securelist-extract.mjs
```

---

## 更新摘要（近期）

| 版本 | 要点 |
|------|------|
| **1.4.3** | Securelist 分节、多级云域名、粘连域名、精确置信收紧 |
| **1.4.2** | X/Twitter 自动下拉采推文 |
| **1.4.1** | X 推文汇总与 defang 增强 |
| **1.4.0** | Shadow/iframe、STIX/MISP、右键与快捷键 |

更早版本见 Git 历史或本文件旧版 changelog。

---

## 许可与贡献

本项目为本地使用的浏览器扩展源码包。改进建议与 PR 欢迎围绕**提取准确度、噪音过滤、站点适配**展开。
