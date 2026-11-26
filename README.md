# DSH SKILLBOX

一个独立、无前端依赖的 DeepSeek Harness Skill、界面主题与 MCP 聚合站。支持技能 / 主题 / MCP 分栏、搜索、分类、排序、安装验证筛选、本地收藏、项目详情和复制安装命令。

首页包含原创 Canvas 像素互动场景：大肥鱼追随指针、下雪、蛋炒饭爱心、蘑菇弹跳，支持鼠标、触摸和键盘，无外部图片或音频依赖。

## 本地运行

在此目录启动任意静态 HTTP 服务，例如：

```bash
npx serve .
```

然后打开终端显示的地址。不要直接双击 `index.html`，浏览器会阻止读取本地 JSON。

## 更新技能数据

Windows PowerShell：

```powershell
./scripts/update-data.ps1
```

脚本读取 dsh.so 的精选榜单索引，生成 `data/themes.json` 和 `data/mcp.json`，并将精选技能与 GitHub 的 `awesome-dsh-plugins` 技能目录去重合并到 `data/skills.json`。技能图片使用对应 GitHub 仓库的 Open Graph 示例图，支持懒加载和失败占位。

也可单独更新 GitHub 技能：

```powershell
./scripts/update-github-skills.ps1
```

更新后检查数据与页面，再提交变更。

## 部署

将仓库根目录的静态文件上传到任意 Web 服务器即可，无需构建、数据库或后端。入口为 `index.html`，数据入口为 `data/skills.json`、`data/themes.json` 和 `data/mcp.json`。

## 数据与许可

- 站点代码：MIT，见 `LICENSE`。
- 精选技能、主题与 MCP 元数据：[dsh.so Plugin Market](https://www.dsh.so/market/)，按 **CC BY 4.0** 署名复用。
- GitHub 技能元数据：[awesome-dsh-plugins](https://github.com/dshworks/awesome-dsh-plugins)，按 **MIT** 许可复用；导入 `SKILL.md` 技能，以及名称或来源证据明确表明用途的 DSH 技能插件包。
- 各 Skill / 插件的代码、图文和许可证归对应作者所有；本站不重新分发其安装包，详情页提供原 GitHub 仓库链接。
- “安装已验证”与“路径已核验”均来自对应数据源，不代表本站人工审计或 DeepSeek 官方背书。安装前应核对原仓库、许可证和 DSH 版本要求。

维护者：[xifeng666888](https://github.com/xifeng666888)。本站是社区导航项目，不是 DeepSeek 官方站点。
