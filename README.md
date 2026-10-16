# photo-zinc-lab

光锌能源实验室：以光辅助与光充电锌离子电池为核心，并拓展锂、钠、铝等金属离子光储能文献。

[访问网站](https://terryliu0125-ship-it.github.io/photo-zinc-lab/)

## 文献资料

截至 2026-10-15，文献库共 120 篇（100 篇研究、20 篇综述/观点），保留中文标题、简介、阅读提示和 DOI。锌基相关文献 72 篇，其他金属离子电池 47 篇，关联储能器件 1 篇。老师分享的 4 篇论文标记“老师分享”；其中 3 篇研究、1 篇 Perspective。公众号仅保留用户提供的原始链接，内容尚未核对，与学术论文分开呈现。

课题组成果页面 `group.html` 集中展示 9 篇已确认工作：用户提供 8 篇，按作者 ORCID 与单位补检 1 篇。原有 5 条保留，补录 VO₂ 综述、SnO₂@MnO₂ 光正极、氧化铁纤维超级电容器及 ZnO@MnO₂ 光正极 4 条。阅读范围新增“课题组成果”，支持与材料、类型组合筛选。普通超级电容器归为“关联储能器件”；K⁺ 预嵌入研究保留出版社 Corrigendum 入口，更正不作为独立研究计数。课题组页面由文献数据自动生成，更新数据后运行既有渲染脚本即可同步。

新增书目的 DOI、题目、作者、卷页及发表日期经 Crossref 核对，中文导读依据公开摘要与书目记录整理。锂/钠金属半电池、光热增强、转化型储能和光伏集成器件在导读中注明；跨体系综述可能涵盖金属空气或超级电容器，应按具体章节阅读。文献不是穷尽性检索，也不代表本站自有成果。

电池体系、研究/综述类型、材料主题与年份可交叉筛选，支持中英文标题、作者、材料和 DOI 搜索、年份排序、引文复制及 BibTeX/RIS 下载。全部文献在 `literature.html` 中完整呈现，启用 JavaScript 时分页浏览，关闭 JavaScript 仍可阅读全文。首页只展示入口，不加载论文列表。旧版 `#literature`、`#mechanism`、`#reading-guide` 与 `#paper-Lxx` 链接会自动转到对应新页面。

- `index.html`：简洁首页与页面导航
- `principles.html`：光辅助原理、充电模式与实验判断
- `literature.html`：独立文献库、交叉筛选与每页 6 篇的卡片浏览
- `guide.html`：阅读路线、研究范围和推荐文献入口
- `site.css` / `site.js`：统一页面风格与旧锚点链接兼容
- `principles.css` / `principles.js`：光辅助定义、三种充电模式图解、能带条件、机制与实验判断
- `literature.css` / `literature.js`：文献库样式和交互
- `literature.json`：结构化书目信息与中文导读
- `references.bib` / `references.ris`：可导入 Zotero、EndNote 等工具的引文文件
- `REFERENCES.md`：逐篇文献及 DOI、Crossref 来源记录

这是无需构建的静态网站。GitHub Pages 使用 `main` 分支根目录；提交后通过仓库的 Actions 查看部署结果。

更新文献只需修改 `literature.json`（`title_zh` 为中文标题，`summary` 为中文简介，`article_type` 使用 `research` 或 `review`，`battery_category` 使用 `zinc` 或 `other-metals`，`metal_system` 记录具体金属体系），然后运行 `python3 scripts/render_library.py`，同步首页统计、文献页 HTML、内嵌数据、年份与主题数量、BibTeX、RIS 及 `REFERENCES.md`。请核对新增 DOI 及期刊年份，保留器件类型与原始研究/综述的区别。

修改 CSS/JavaScript 后，同时更新 HTML 中资源 URL 的 `v` 参数，避免 GitHub Pages 的浏览器缓存继续使用旧代码。

## 检索、书架与对比

- 电池体系、材料体系、阅读范围、研究方向与类型/年份可组合筛选。同一组多选采用 OR，不同组采用 AND；已选条件可单独移除，并通过 URL 恢复。
- 搜索支持化学式 NFKC 规范化、中英文同义词及相关度排序。无结果时提供 Google Scholar/Crossref 的站外检索链接，不声称站内覆盖所有论文。
- vanadium.html 提供从综述、结构水、预嵌入与质子到稳定性及光辅助的阅读路线。
- 收藏、待读/在读/已读、个人笔记以 DOI 为键保存在当前浏览器。支持 JSON 导出与合并导入；清除浏览器站点数据会移除本地记录，请自行保存备份。
- 可跨分页选择 2–4 篇论文对比，并导出带出处的 CSV 或复制公开对比链接。数值单元格列出对应条件和定位；空白表示本库尚未录入已核实数据，不代表原文未报告。不会对不同工况的容量自动排名。
- library-core.js 负责搜索、筛选、URL 状态与阅读记录校验；literature.js 负责页面交互；research-tools.css 延续原编辑式视觉风格。
- literature.json 中 material_groups、research_topics 为人工整理的检索标签；comparison_evidence 为逐字段的值、工况、来源与定位。自动新增条目使用已有标签回退，未核实的性能数据留空。

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
node --test tests/library-core.test.cjs
python3 scripts/update_literature.py refresh --dry-run
```

后续自动收录若缺少中文译名或可靠的类型标注，会明确显示“中文标题待补充”或“待分类”，待人工补齐后再重新生成；不依据标题关键词强行认定为研究论文。

## 钒基能带比较

`bands.html` 提供逐样品的能带对齐与光充电初筛。截至2026-10-16共22条记录：14条可统一到SHE，4条待补绝对带边或参比条件，4条仅有功函数/d带中心的电子参数参考。14条中包含作者示意图与UPS/光学推导值，不能统称为完整实测能带。新增同文VO₂/ZnO传输层、V₂O₅与CsV₃O₈/V₂O₅的UPS样品、CdS/ZnO光电容器组分及待补pH的ZnIn₂S₄；后几类不代表与钒基配对后的直接光充电已经验证。

目录主值、比较图及无JavaScript目录统一显示V vs SHE，详情保留原数值与原参比，并列SHE、真空电子能量与标准Zn近似三种坐标。`bands-data.json`保留晶相、样品、方法、pH、证据等级、DOI和页图定位；这是逐样品证据表，不是材料通用常数或穷尽性数据库。更新后运行 `python scripts/render_bands.py`，`--check`检查生成一致性。公开仓库不保存老师原始PDF或本地路径。

真空电子能量按 ε=−(U_SHE+4.44) eV换算，采用25°C水系约定。RHE必须提供pH，U_SHE=U_RHE−0.05915935×pH；Ag/AgCl、SCE需要测量条件对应的显式参比偏移。Zn满足U_SHE=U_vsZn+U_Zn_vsSHE：缺实际偏移会阻止换算，只有明确选择标准态近似才使用−0.76 V。Zn°输出始终注明是标准态近似，非实际电解液中的Zn电极；碱性锌酸根半反应不能混同自由Zn²⁺/Zn。原文NHE按SHE常用近似显示并保留提示。统一坐标不消除pH、电解液、晶相或荷电态差异，也不能由Eg、功函数或平带单独推出绝对带边。

参比换算器支持SHE/NHE、真空、RHE、Ag/AgCl、SCE与Zn。反应余量输入可选SHE或Zn，正极电位转换与Zn沉积使用同一参比；Type I/II/III仍仅按接触前独立组分形式初筛。以CB/VB代替光照准费米能级属于乐观上限，结果不证明直接光充电。默认比较为同文VO₂/ZnO样品，跨论文组合另行提示。

22条记录附15篇来源论文的完整引文、中文标题、能带图定位与独立合成章节。`synthesis`保留路线、原料、条件、相确认、SI入口及缺项；11条有主要步骤摘要，11条仅部分信息。主要步骤已核不等于完整复现规程。两条UPS样品使用同一样品的功函数、VBM与Eg透明推导；保留原文表格/示意的0.02 eV差异。ZnIn₂S₄保留−0.732/+1.718 V vs RHE，但缺pH时不画入SHE图，不默认pH7。

本组输入仅保留在当前页面会话。CSV/JSON导出包含原值、SHE值、坐标依据及参比条件；公开分享链接仅包含公共样品ID。检查：`node --test tests/band-core.test.cjs`、`python scripts/render_bands.py --check`、`python -m unittest discover -s tests`。静态与交互坐标通过全数据逐条核对。
