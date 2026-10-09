# 项目约定

## 推送目标（重要）

- **唯一允许推送的目标**是 fork：远端 `origin` = `https://github.com/moonee-pt/polaris-local-first.git`。
  日常就用 `git push origin main`。
- 远端 `upstream` = `https://github.com/Aevella/polaris-local-first.git` 是**原作者的仓库**，只 fetch，推送地址已被改成 `no_push`：可以 fetch 和参考，**禁止 push**，也不要改它上面的任何东西（分支、标签、PR、设置）。
- 如果哪天又出现指向原作者仓库的推送目标，不要绕过失败去换凭据或换远端重试，停下来说明。
- 本机保存的 GitHub 凭据属于 `moonee-pt`，只对上面那个 fork 有写权限。
