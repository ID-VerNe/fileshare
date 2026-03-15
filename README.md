# FileShare - 安全增强型 OneDrive 文件共享门户 (v3.0)

`FileShare` 是一个轻量级、自托管的 Web 应用程序，它作为 Microsoft Graph API 的安全代理，通过"取件码"（短码映射）为你的 OneDrive 文件提供美观、安全且功能丰富的管理界面。

**v3.0 重大更新**：引入了 SQLite 数据库管理、短码映射、管理员后台以及端到端的数据脱敏。

## ✨ 核心特性

### 🔐 顶级安全性 (Security First)
*   **API 凭据零暴露**: 所有敏感的 Client Secret 仅存储在后端 `.env`。
*   **防 IDOR 攻击**: 采用 Context-bound 加密算法，文件 ID 与分享短码强制绑定，无法跨链接越权访问。
*   **深度数据脱敏**: 后端自动过滤 OneDrive 内部路径、用户邮箱、Drive ID 等敏感元数据，仅返回 UI 必须的脱敏数据。
*   **物理隔离上传**: 生成临时 Upload URL 直接上传至微软服务器，木马文件无法接触你的 Web 服务器。
*   **速率限制 (Rate Limiting)**: 内置针对真实 IP（支持 Cloudflare）的请求频率限制，有效防止爆破。

### 🛠️ 管理与权限
*   **短码映射 (Short Code Mapping)**: 不再直接公开 OneDrive 长 ID，使用数据库映射生成优雅的短码（取件码）。
*   **图形化管理后台**: 内置管理员 API，可轻松创建、删除分享链接并一键开关上传权限。
*   **细粒度权限**: 每个分享链接可独立设置是否允许上传，权限在 Session 级别隔离。

### 📂 文件浏览与交互
*   **双视图模式**: 经典的列表视图与直观的网格（缩略图）模式。
*   **智能导航**: 完整的面包屑路径支持，文件夹单击进入，体验如丝般顺滑。
*   **实时搜索与排序**: 支持按名称、大小、日期实时过滤。
*   **环境适配**: 专门针对免费主机（如珊瑚云）进行了优化，自动防御 HTML 广告注入导致的 JSON 解析错误。

## 🏛️ 系统架构

1.  **前端 (React/TS)**: 负责渲染精美的 UI，通过 `parseJsonWithCleanup` 增强容错性。
2.  **后端 (PHP 8.x)**: 
    - **SQLite 驱动**: 存储分享映射、访问统计和速率限制数据。
    - **ID 混淆层**: 负责将真实 OneDrive ID 转换为上下文绑定的混淆 ID。
    - **脱敏层**: 过滤掉所有微软原生的敏感 JSON 字段。
3.  **存储 (OneDrive)**: 所有的文件实际物理存储在微软云端。

## 🚀 快速部署

### 1. Azure 应用注册
参考 [Microsoft 文档](https://learn.microsoft.com/en-us/graph/auth-register-app-v2) 注册应用，获取 `CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID`。确保拥有 `Files.ReadWrite.All` 权限。

### 2. 配置后端环境
将 `api` 目录上传，并在其同级目录创建 `.env`：

```env
MS_GRAPH_CLIENT_ID="xxx"
MS_GRAPH_CLIENT_SECRET="xxx"
MS_GRAPH_TENANT_ID="xxx"
MS_GRAPH_USER_ID="xxx"
ADMIN_API_KEY="你的管理后台密钥"
```

### 3. 构建前端
```bash
pnpm install
pnpm build
```
将 `dist` 目录内容上传至 Web 根目录。

## 🎨 界面设计
采用 **Solarized Light** 调色板，配合 **Material Icons**，旨在提供最舒适的视觉体验。

---
## 📝 修改与二次开发
*   **后端**: 核心逻辑位于 `api/config.php` (配置与混淆) 和 `api/files.php` (数据清洗)。
*   **前端**: `App.tsx` 处理状态机，`services/graphService.ts` 负责与脱敏后的后端交互。

## 📄 许可证
MIT License.
