# 用 Git Bash 把工作台推到 GitHub（大白话步骤）

> 目标：把你电脑上 `D:\workbuddy\2026-07-22-20-29-18` 这个完整文件夹（含 css/js/data 子文件夹）推到 GitHub，手机就能装成 App。

---

## 一、打开 Git Bash 并进入文件夹

方法 A（最省事）：在你电脑上打开文件夹 `D:\workbuddy\2026-07-22-20-29-18`，在空白处**右键 →「Git Bash Here」**。黑框框打开就自动在这个目录了。

方法 B（没有这个右键选项）：打开「Git Bash」（开始菜单搜得到），然后手动进目录：
```
cd /d/workbuddy/2026-07-22-20-29-18
```
⚠️ 注意：Git Bash 里盘符要写成 `/d/...`，不是 `D:\...`。

先验证一下进对没：输入 `pwd`，应该显示类似 `/d/workbuddy/2026-07-22-20-29-18`。

---

## 二、一条条复制粘贴执行

下面 6 行，一次贴一行、按回车（也可以整段一起贴）：

```
git init
git add .
git commit -m "完整版工作台"
git branch -M main
git remote add origin https://github.com/happy-5022/Yuting-Workstation.git
git push -u origin main --force
```

- `git add .` 的「.」意思是"当前目录所有文件"，会把 css/js/data 子文件夹一起带上 ✅
- 最后一行 `--force` 是用你电脑上**完整版**直接替换线上那个**残缺版**，正合你意。

如果报 `remote origin already exists`（之前连过），先执行 `git remote remove origin`，再重跑最后两行。

---

## 三、最容易卡的一步：要你输"密码"

GitHub 从 2021 年起**不让用登录密码推代码**了，要用一个「专用密码」叫 **Personal Access Token（简称 PAT）**：

- 黑框框问 **Username**（用户名）→ 填 `happy-5022`
- 问 **Password**（密码）→ **填 PAT，不是你的登录密码**

### 怎么拿到 PAT（一次性，几分钟）
1. 电脑浏览器打开 github.com，登录
2. 右上角头像 → **Settings**
3. 左边最底下 **Developer settings** → **Personal access tokens** → **Tokens (classic)**
4. 点 **Generate new token (classic)**
5. Note 随便写（如 `my-push`）；Expiration 选 **No expiration**（或 90 days）
6. 勾选 **repo**（这一项代表所有仓库权限，够了）
7. 拉到底点 **Generate token**
8. **那一串 `ghp_xxxx` 立刻复制保存好**（只显示这一次！）👉 这就是你的"专用密码"

> 小提示：如果你之前在 Git Bash 里配过 SSH key 并加到了 GitHub，那 push 可能直接就过、不用 PAT。先试着推，要密码再回来按上面拿。

---

## 四、推完验收

1. 回到 `https://happy-5022.github.io/Yuting-Workstation/` 刷新，等 1–2 分钟
2. 应该能看到**米黄背景、完整功能**的工作台（之前是白板残版）
3. 手机打开这个网址 → 点「分享」→ **「添加到主屏幕」** → 完成！桌面就有图标，点开是 App，离线也能开 🎉

---

## 五、报错怎么办（对照自查）
- **说 `main` 不存在** → 把命令里所有 `main` 换成 `master` 再试（GitHub 老仓库默认叫 master）
- **force 被拒 / protected branch** → 告诉我，我给你另一条命令
- **认证失败 / 密码不对** → 确认填的是 PAT（ghp_ 开头），不是登录密码
- **push 很慢或超时** → 国内连 GitHub 偶尔慢，多试一两次，或挂网络再推

卡住随时把报错截图/文字发我，我陪你过 👍
