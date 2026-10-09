# 项目约定

## 推送目标（重要）

- **唯一允许推送的目标**是 fork：`https://github.com/moonee-pt/polaris-local-first.git`。
  推送命令固定写全 URL：`git push https://github.com/moonee-pt/polaris-local-first.git main`。
- `Aevella/polaris-local-first` 是**原作者的仓库**（当前 `origin` 指向它），只读：可以 fetch 和参考，**禁止 push**，也不要改它上面的任何东西（分支、标签、PR、设置）。
- 不要执行 `git push origin main` 这类可能落到原作者仓库的写法；不要为了绕过 403 去换凭据、换远端或换方式重试，遇到没权限就停下来说明。
- 本机保存的 GitHub 凭据属于 `moonee-pt`，只对上面那个 fork 有写权限。
