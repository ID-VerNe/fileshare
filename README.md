# FileShare - 极简 OneDrive 文件共享门户

`FileShare` 是一个轻量级、自托管的 Web 应用程序，它通过一个简单的“取件码”为你的 OneDrive 文件或文件夹提供了一个美观、易用的分享、下载和上传界面。

该项目采用前后端分离架构，前端使用 React 和 TypeScript 构建，后端则由 PHP 实现，作为与 Microsoft Graph API 安全交互的中间层。

## ✨ 主要功能

*   **取件码访问**: 用户只需输入一个取件码（即 OneDrive 中的项目 ID）即可访问指定的文件或文件夹。
*   **文件浏览**: 支持列表和网格两种视图模式，清晰地展示文件夹内容。
*   **文件预览**: 为图片等常见文件类型提供缩略图预览。
*   **文件下载**: 两步式安全下载。先获取临时下载链接，再进行下载，避免直接暴露永久链接。
*   **文件上传**: 支持向当前文件夹上传新文件，并提供实时上传进度条。
*   **响应式设计**: 界面在桌面和移动设备上均有良好体验。
*   **易于部署**: 无需数据库，仅需一个支持 PHP 的 Web 服务器和 Node.js 环境。

## 🏛️ 架构解析

本项目的核心思想是**安全**与**简洁**。前端（React）本身不包含任何敏感的 API 密钥，所有与 Microsoft Graph API 的交互都通过后端（PHP）代理完成。

1.  **用户 (浏览器)**: 与 React 前端应用进行交互。
2.  **React 前端**: 负责渲染 UI 界面。当需要获取文件列表、下载链接或上传文件时，它会向自己的 PHP 后端发送请求。
3.  **PHP 后端**:
    *   **安全凭证存储**: 唯一存储 Microsoft Graph API 客户端 ID 和密钥的地方。
    *   **身份验证**: 负责从微软获取 Access Token，并使用 PHP Session 进行缓存，避免重复请求。
    *   **API 代理**: 接收前端请求，然后使用有效的 Access Token 向 Microsoft Graph API 发起真正的请求，并将结果返回给前端。
4.  **Microsoft Graph API**: 微软提供的云服务接口，是所有文件操作的最终执行者。

这个架构确保了你的 `Client Secret` 永远不会暴露在最终用户的浏览器中。

## 🚀 部署与设置指南

部署此项目需要完成三个主要步骤：注册 Azure 应用、配置后端和构建前端。

### **步骤一：注册 Microsoft Azure 应用**

这是最关键的一步，目的是为了获取与 Graph API 通信的凭证。

1.  登录到 [Azure Portal](https://portal.azure.com/)。
2.  导航到 **Azure Active Directory** > **应用注册** > **新注册**。
3.  为你的应用命名（例如 `OneDrive FileShare Portal`），选择“任何组织目录中的帐户(任何 Azure AD 目录 - 多租户)和个人 Microsoft 帐户(例如 Skype、Xbox)”支持的帐户类型。
4.  点击**注册**。
5.  在应用概览页面，复制并保存以下两个值：
    *   **应用程序 (客户端) ID** (`MS_GRAPH_CLIENT_ID`)
    *   **目录 (租户) ID** (`MS_GRAPH_TENANT_ID`)
6.  导航到**证书和机密** > **新建客户端密码**。
    *   添加一个描述，选择过期时间（建议选择一个较长的时间），然后点击**添加**。
    *   **立即复制**新生成的**值**。这个值就是你的 `MS_GRAPH_CLIENT_SECRET`。**注意：离开此页面后你将无法再次看到它！**
7.  导航到 **API 权限** > **添加权限** > **Microsoft Graph**。
    *   选择**应用程序权限**。
    *   搜索并勾选 `Files.ReadWrite.All`。选择此权限意味着你的应用有权读写你账户下的所有文件，请务必保管好你的密钥。
    *   点击**添加权限**。
    *   最后，点击**“为 [你的租户名] 授予管理员同意”** 按钮，并确认。

### **步骤二：配置后端 (PHP)**

1.  将 `api` 文件夹上传到你的 Web 服务器上一个能够执行 PHP 的目录。
2.  在项目的根目录下（即 `api` 文件夹的上一级），创建一个名为 `.env` 的文件。
3.  复制以下内容到 `.env` 文件中，并填入你在上一步中获取的值。

    ```env
    # .env.example
    MS_GRAPH_CLIENT_ID="你的应用程序(客户端)ID"
    MS_GRAPH_CLIENT_SECRET="你的客户端密码值"
    MS_GRAPH_TENANT_ID="你的目录(租户)ID"
    MS_GRAPH_USER_ID="你的 OneDrive 用户 ID 或 userPrincipalName"
    ```
4.  **如何获取 `MS_GRAPH_USER_ID`？**
   *   `userPrincipalName` 通常就是你的微软登录邮箱地址。
   *   你也可以通过 Graph Explorer 工具获取确切的 User ID。

### **步骤三：构建并部署前端 (React)**

1.  在本地开发环境中，确保你已安装 [Node.js](https://nodejs.org/) 和 `npm` (或 `yarn`)。
2.  在项目根目录下，打开终端并运行以下命令安装依赖：
    ```bash
    npm install
    ```
3.  **重要：配置 API 地址**
   *   在 `src/services/` 目录下的文件中（例如 `graphService.ts`），你会看到 `fetch` 请求。请确保这些请求的 URL 指向你部署的 PHP API 地址。默认情况下，它们可能是相对路径（如 `/api/files.php`），这要求前端和后端部署在同一个域名下。
4.  运行以下命令来构建用于生产环境的前端静态文件：
    ```bash
    npm run build
    ```
5.  构建完成后，会在项目根目录生成一个 `build` (或 `dist`) 文件夹。将此文件夹内的**所有内容**上传到你的 Web 服务器的根目录。

### **Web 服务器配置示例 (Nginx)**

为了让前端和后端协同工作，一个常见的做法是配置 Nginx。

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/your-site/build; # 指向前端构建文件的目录
    index index.html;

    location / {
        try_files $uri /index.html; # 处理 React Router
    }

    # 将所有 /api 的请求代理到 PHP 处理器
    location /api {
        root /var/www/your-site; # 指向包含 api 文件夹的目录
        try_files $uri =404;
        
        # 确保 PHP-FPM 正确配置
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

## 🧑‍💻 如何使用

### **获取取件码 (`itemId`)**

`itemId` 是 OneDrive 中每个文件或文件夹的唯一标识符。你需要获取你想要分享的那个项目的 ID。这里提供两种方法：

#### **方法一：通过 OneDrive 网页版“嵌入”功能**

这种方法比较直观，但可能不适用于所有类型的账户。

1.  登录你的 [OneDrive 网页版](https://onedrive.live.com/)。
2.  找到你想要分享的**文件夹**或**文件**。
3.  右键点击它 > **嵌入**。
4.  在右侧弹出的侧边栏中，点击 **“生成”**。
5.  在生成的 HTML 代码中，找到 `resid=` 部分。等号后面的字符串就是 `itemId`。
    *   例如，在 `...src="https://onedrive.live.com/embed?resid=ABCDEFG123456!789&..."` 中，`itemId` 就是 `ABCDEFG123456!789`。

#### **方法二：使用 Microsoft Graph Explorer (推荐)**

这种方法更为通用和强大，能准确地找到任何文件或文件夹的 ID。

1.  访问 [Microsoft Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)。
2.  点击右上角的 **Sign in** 按钮，用你的 OneDrive 所在账户登录。
3.  登录后，在查询输入框中，使用以下查询来列出你 OneDrive **根目录**下的所有项目：
    ```
    GET https://graph.microsoft.com/v1.0/me/drive/root/children
    ```
4.  点击 **Run query**。
5.  在下方的 **Response preview** 区域，你会看到一个 JSON 格式的返回结果。这是一个包含文件和文件夹信息的列表。
6.  在这个列表中，通过 `name` 字段找到你想要分享的项目，然后复制它对应的 `id` 字段的值。这个值就是你需要的 `itemId`。

    ```json
    {
        "value": [
            {
                "id": "THIS_IS_THE_ITEM_ID_YOU_NEED_12345", // <-- 复制这个 ID
                "name": "我的共享文件夹",
                "folder": { "childCount": 5 },
                "...": "..."
            },
            {
                "id": "ANOTHER_ITEM_ID_67890",
                "name": "我的文档.docx",
                "file": { "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
                "...": "..."
            }
        ]
    }
    ```

7.  **如果文件在子文件夹中**：你可以在列表中先找到那个子文件夹的 `id`，然后构造一个新的查询来查看该文件夹的内容，格式为： `https://graph.microsoft.com/v1.0/me/drive/items/{文件夹的ID}/children`，然后重复步骤 5 和 6。

### **开始分享**

打开你部署的网站，将复制的 `itemId` 粘贴到“取件码”输入框中，点击“获取文件”即可开始浏览、上传和下载。


## 🛠️ 修改与二次开发

如果你想对项目进行修改或扩展，请参考以下指南：

*   **前端代码**:
    *   **主应用逻辑**: `App.tsx` 是核心文件，包含了所有的状态管理、事件处理和视图渲染逻辑。
    *   **API 服务**: 对后端的 HTTP 请求被封装在 `src/services/` 目录下的文件中。例如 `graphService.ts` 和 `uploadService.ts`。
    *   **UI 组件**: 可重用的 UI 组件（如 `Spinner.tsx`, `FileIcon.tsx`）位于 `src/components/` 目录。
    *   **样式**: 项目使用 **Tailwind CSS**。你可以通过修改 `className` 属性或编辑 `tailwind.config.js` 文件来调整样式。

*   **后端代码**:
    *   `api/config.php`: 负责加载 `.env` 配置、获取和缓存 Graph API 的 Access Token。
    *   `api/files.php`: 处理获取文件列表和生成下载链接的请求。
    *   `api/upload.php`: 处理创建文件上传会话的请求。

*   **添加新功能示例：增加删除文件功能**
    1.  **前端 (`App.tsx`)**:
        *   在文件列表项中添加一个“删除”按钮。
        *   创建一个新的 `handleDeleteFile(fileId)` 函数。
        *   在此函数中，调用一个新的后端服务，例如 `deleteFileOnBackend(fileId)`，并向 `/api/delete.php?fileId=...` 发送一个 `DELETE` 请求。
        *   成功后，从 `files` 状态中移除该文件。
    2.  **后端 (创建 `api/delete.php`)**:
        *   引入 `config.php` 获取 `$accessToken` 和 `$userId`。
        *   从 `$_GET` 中获取 `fileId`。
        *   构建 Graph API 的 `DELETE` 请求 URL：`https://graph.microsoft.com/v1.0/users/{userId}/drive/items/{fileId}`。
        *   使用 cURL 发送一个 `DELETE` HTTP 请求到该 URL。
        *   根据 Graph API 的返回结果，向前端返回成功或失败的 JSON 响应。