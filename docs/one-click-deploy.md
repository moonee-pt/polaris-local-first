# 一键免费部署（手机访问）

Polaris 前端是纯静态站点（`npm run build` 产出 `dist/`），
内置数据全部存在浏览器本地（IndexedDB/KV），所以托管一个静态站点就能在手机上使用。
只有「模型调用」需要外部服务：要么用你自己的 API Key，要么让后端提供密钥。

## 方案一：Vercel（推荐，一键 + 自带 `/api` 后端）

点下面的按钮（需要 GitHub 登录 + 免费 Vercel Hobby 账号）：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Aevella/polaris-local-first)

仓库已包含 `vercel.json`，构建命令与输出目录会自动识别：

- Build Command: `npm run build`
- Output Directory: `dist`

想要「Polaris 内置免费模型」可用，在 Vercel 项目里加环境变量（任选其一）：

```
OPENROUTER_API_KEY=
MIMO_API_KEY=
SILICONFLOW_API_KEY=
```

不加也能用，只是要自己在应用「设置 → 供应商」里填自己的 API Key。
它会同时部署静态前端和 `api/` 下的同源接口（provider-relay、search、图像/语音转发等）。

## 方案二：Cloudflare Pages（免费额度大、带宽不限）

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git，选中本仓库。
2. 构建配置：
   - Build command: `npm run build`
   - Build output directory: `dist`
3. 保存部署，得到 `https://<项目名>.pages.dev`。

注意：这条路径只有静态前端，**不含** `/api` 接口，所以内置免费模型不可用；
模型请在应用内配置「自带 API Key」的供应商（浏览器直连）。

## 方案三：本机局域网（零账号，同一 WiFi）

```bash
npm run build
npx vite preview --host 0.0.0.0 --port 4173
```

手机连同一个 WiFi，打开 `http://<电脑局域网IP>:4173/`。
电脑关机或退出命令后即失效，适合临时用。

## 手机上「添加到主屏幕」

- iOS Safari：分享 → 添加到主屏幕
- Android Chrome：菜单 → 添加到主屏幕

仓库已提供 `public/manifest.webmanifest` 与 `public/icons/apple-touch-icon.png`，
图标与名称会正常显示。注意：通过 `http://<局域网IP>` 访问属于非安全来源，
部分浏览器 API 受限；用 HTTPS 的线上地址体验最完整。

## 常见问题

- 打开后发消息报「Failed to fetch」：当前站点没有 `/api` 接口（纯静态托管），
  请改用自带 API Key 的供应商，或改用方案一。
- 数据在哪里：浏览器本地。换设备、清缓存不会自动同步，请使用应用内导出/导入。
