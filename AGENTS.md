# 项目约定

## 推送目标（重要）

- **唯一允许推送的目标**是 fork：远端 `origin` = `https://github.com/moonee-pt/polaris-local-first.git`。
  日常就用 `git push origin main`。
- 远端 `upstream` = `https://github.com/Aevella/polaris-local-first.git` 是**原作者的仓库**，只 fetch，推送地址已被改成 `no_push`：可以 fetch 和参考，**禁止 push**，也不要改它上面的任何东西（分支、标签、PR、设置）。
- 如果哪天又出现指向原作者仓库的推送目标，不要绕过失败去换凭据或换远端重试，停下来说明。
- 本机保存的 GitHub 凭据属于 `moonee-pt`，只对上面那个 fork 有写权限。

## 版本号

- 版本号只有一个来源：`package.json` 的 `version`。构建时由 vite 注入，界面通过 `src/config/appVersion.ts` 的 `APP_VERSION` 读取，显示在左上角"切换房间"抽屉的底部。不要再建别的版本常量。
- **每次提交都把版本号往上加**，按改动大小：
  - 修 bug、文案、样式微调 → 末位 +1（1.0.1 → 1.0.2）
  - 新功能、新交互 → 中位 +1、末位归零（1.0.x → 1.1.0）
  - 方向性重做、数据结构不兼容 → 首位 +1（→ 2.0.0）
- 推送成功之后，**回复里必须告诉她当前版本号**（例："已推送，当前版本 1.0.2"）。
- 多个会话共用这一个工作区：提交前先 `git diff HEAD -- package.json` 确认自己要的数字还在，别覆盖并行会话刚 bump 过的版本。

## 配色（项目统一）

- 全站统一粉色 = 底部 tab 栏的粉：主色 `#f6b9c9`、浅粉 `#fff2f6`、线条与细节 `#d588a1`、粉底上的文字与图标 `#c46f8d`。令牌定义在 `src/styles/tokens.css`：`--pink` / `--pink-light` / `--pink-ink` / `--pink-ink-deep`，写样式一律用令牌，不要再写死色号。
- 表示「进行中」「强调」的地方一律用这个粉色，界面里不要再出现蓝色（2026-10-12 用户令「里面不要蓝色 整体和谐」「这个粉色项目统一使用」）。
- 状态语义保留：完成=绿、受阻=琥珀、失败=红；只把蓝色替换成粉色。