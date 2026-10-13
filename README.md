# photo-zinc-lab

光锌能源实验室：光辅助与光充电水系锌离子电池的研究介绍和精选文献阅读入口。

[访问网站](https://terryliu0125-ship-it.github.io/photo-zinc-lab/)

## 文献资料

截至 2026-10-13，文献库共 45 篇：44 篇精选条目和 1 篇自动收录条目，覆盖 2019—2026 年。这次补充 31 篇，扩展锰基光正极、有机框架、钙钛矿、质子–离子耦合及柔性纤维器件等方向。新增条目的 DOI、题目、作者与卷页通过 Crossref 注册记录核对；中文导读依据公开摘要与书目整理，具体实验结论以原文为准。文献不代表本站自有成果，也不是穷尽性检索。

现有 45 篇均提供中文译名与中文简介，分为 38 篇研究论文、7 篇综述/观点文章。文献类型、研究主题与年份可交叉筛选，支持中英文标题、作者、材料和 DOI 搜索，年份排序、引文复制及 BibTeX/RIS 下载。英文原题用于标准引文导出，中文标题为本站译名。文献在 HTML 中完整呈现，关闭 JavaScript 仍可直接浏览。

- `index.html`：首页和文献列表
- `literature.css` / `literature.js`：文献库样式和交互
- `literature.json`：结构化书目信息与中文导读
- `references.bib` / `references.ris`：可导入 Zotero、EndNote 等工具的引文文件
- `REFERENCES.md`：逐篇文献及 DOI、Crossref 来源记录

这是无需构建的静态网站。GitHub Pages 使用 `main` 分支根目录；提交后通过仓库的 Actions 查看部署结果。

更新文献只需修改 `literature.json`（`title_zh` 为中文标题，`summary` 为中文简介，`article_type` 使用 `research` 或 `review`），然后运行 `python3 scripts/render_library.py`，同步 HTML、内嵌数据、年份与主题数量、BibTeX、RIS 及 `REFERENCES.md`。请核对新增 DOI 及期刊年份，保留器件类型与原始研究/综述的区别。

修改 CSS/JavaScript 后，同时更新 HTML 中资源 URL 的 `v` 参数，避免 GitHub Pages 的浏览器缓存继续使用旧代码。

## 每日文献更新与邮件日报

网站更新和邮件发送分别执行。`.github/workflows/daily-literature.yml` 每天 UTC 00:17（北京时间 08:17）检索 Crossref、按 DOI 去重并更新 GitHub Pages。合并到 `main` 后才会开始定时运行；GitHub 调度可能延迟，运行状态以 Actions 为准。

邮件由 Codex 中已连接的 Gmail 账号发给用户指定的收件地址。Codex 的每日定时任务在本机运行 `refresh` 和 `email`，调用 Gmail 连接发送后，再用 `ack-email` 记录成功发送的摘要。邮箱密码、QQ 授权码和 Gmail 凭据都不写入仓库。这个本机任务需要电脑开机、Codex 运行且 Gmail 连接有效；它不依赖 GitHub 网站更新是否已发布。

自动检索关注光辅助、光充电锌离子电池/储锌，排除锌空气电池、液流电池和电容器。精选文献及中文导读保留，自动检索新增的文献标记为“自动收录 · 待研读”，不生成未经原文支持的性能结论。

### 网站启用

将本次改动合并到 `main`。保持 `Settings → Pages` 为 `Deploy from a branch → main → /(root)`；工作流通过 GitHub Pages 的 [构建接口](https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build) 请求发布。GitHub 自动提供 `GITHUB_TOKEN`；工作流需要 `contents: write` 和 `pages: write`。可选添加 `CROSSREF_EMAIL` 仓库 Secret，作为 Crossref 的 API 联系信息。无需配置邮件发送密钥。

### 邮件任务

每日任务按北京时间 08:17 运行，收件人为本次会话指定的地址。流程：

1. 在本地源目录运行 `python3 scripts/update_literature.py refresh`。若 Crossref 请求失败，不发送“无新增”邮件，也不推进检索时间。
2. 运行 `python3 scripts/update_literature.py email`，读取 JSON 中的邮件标题、HTML 正文和 `digest_id`；结果为 `null` 表示当天已发送或配置为无新增不发。
3. 通过已连接的 Gmail 账号发送。只有 Gmail 明确返回成功后，才运行 `python3 scripts/update_literature.py ack-email --digest-id <digest_id>`。发信失败时不确认，待推送 DOI 保留。

默认无新增也发简短日报，每天最多 10 篇；超出的 DOI 留到之后的日报。若邮件已经被 Gmail 接受，但确认状态写入失败，下一次运行可能重发；可先在 Gmail 已发送邮件中检查同日期的日报再重试。

### 检索配置与验证

`automation/config.json` 默认检索最近 90 天发表、最近 14 天索引的条目，每组查询取相关性最高的 100 个候选；错过执行时从上次成功检索回溯补查。结果受数据库索引延迟、候选上限和标题术语影响，不等于穷尽性系统综述。`exclude_dois` 可排除误匹配的 DOI；`notify_empty` 控制无新增日报。`automation/monitor-state.json` 只包含 DOI 队列及时间，不含凭据。

需要 Python 3.10+，无第三方 Python 依赖。验证命令：

```bash
python3 -m unittest discover -s tests -v
python3 scripts/render_library.py --check
node --check literature.js
python3 scripts/update_literature.py refresh --dry-run
```

后续自动收录若缺少中文译名或可靠的类型标注，会明确显示“中文标题待补充”或“待分类”，待人工补齐后再重新生成；不依据标题关键词强行认定为研究论文。
