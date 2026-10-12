# photo-zinc-lab

光锌能源实验室：光辅助与光充电水系锌离子电池的研究介绍和精选文献阅读入口。

[访问网站](https://terryliu0125-ship-it.github.io/photo-zinc-lab/)

## 文献资料

首批收录 13 篇文献，覆盖 2020—2026 年的代表性实验研究、综述和关联的锌离子电容器研究。书目信息通过 Crossref DOI 注册记录核对（2026-10-12）；中文导读为本站整理。文献不代表本站自有成果，也不是穷尽性检索。

支持题目、作者、材料和 DOI 搜索，主题与年份筛选，年份排序，引文复制，以及 BibTeX/RIS 下载。文献在 HTML 中完整呈现，关闭 JavaScript 仍可直接浏览。

- `index.html`：首页和文献列表
- `literature.css` / `literature.js`：文献库样式和交互
- `literature.json`：结构化书目信息与中文导读
- `references.bib` / `references.ris`：可导入 Zotero、EndNote 等工具的引文文件
- `REFERENCES.md`：逐篇文献及 DOI、Crossref 来源记录

这是无需构建的静态网站。GitHub Pages 使用 `main` 分支根目录；提交后通过仓库的 Actions 查看部署结果。

更新文献时需同步修改 `literature.json`、HTML 中的文献与 `literature-data`、导出文件及文献数量，保持搜索、直接浏览和导出内容一致。请核对新增 DOI 及期刊年份，保留器件类型与原始研究/综述的区别。

修改 CSS/JavaScript 后，同时更新 HTML 中资源 URL 的 `v` 参数，避免 GitHub Pages 的浏览器缓存继续使用旧代码。
