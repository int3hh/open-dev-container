# 仓库指南

## 项目结构与模块组织

本仓库是一个 VS Code 扩展，主入口在 `src/extension.ts`。

- `out/` 存放 TypeScript 编译产物。
- `docs/` 存放架构和产品说明。
- `resources/` 存放扩展图标等静态资源。
- `infra.sh` 负责安装、编译和打包任务。
- Docker、SSH config、容器准备、最近连接和工具函数已拆到 `src/dockerClient.ts`、`src/sshConfig.ts`、`src/containerProvisioner.ts`、`src/recentConnections.ts`、`src/utils.ts` 等模块。

把 `out/`、`dist/`、`node_modules/` 和 `*.vsix` 视为生成产物，不要手工编辑。

## 构建、测试与开发命令

在仓库根目录执行以下命令：

- 直接执行 `bash ./infra.sh` 会依次完成 `lib_update -> build -> pack`。
- `npm run lib_update` 或 `bash ./infra.sh lib_update`：执行 `npm ci` 安装依赖。
- `npm run compile`：编译 TypeScript 到 `out/`。
- `npm test`：先编译，再运行 Node 单元测试。
- `npm run watch`：开发时持续编译。
- `npm run build` 或 `bash ./infra.sh build`：先检查依赖，再编译。
- `npm run package`：执行版本化 VSIX 打包。
- `npm run pack` 或 `bash ./infra.sh pack`：生成 `dist/open-dev-container-<version>.vsix`。

仓库使用 Node 内置测试框架。改动后至少要跑一次 `npm test`，并在扩展宿主里手动验证核心流程。

VSIX 文件名由 `package.json` 的 `name` 和 `version` 生成。发布新包前先 bump `version`，再执行打包命令。

## 代码风格与命名

- 使用 2 空格缩进、单引号和分号。
- 类型、类使用 `PascalCase`，函数和变量使用 `camelCase`，常量使用 `UPPER_SNAKE_CASE`。
- 命令 ID 使用 `open-dev-container.*` 前缀。
- 只在控制流不明显时加简短注释。

## 测试指南

当前使用 Node 内置测试框架。验证时优先检查：

1. `npm test` 是否通过。
2. 扩展是否能在 VS Code 兼容编辑器的扩展宿主中启动。
3. 容器列表、Attach、Reconnect、Disconnect 和清理 SSH 配置是否正常。

测试名称应直接描述行为，不要只写实现细节。

## 提交与 PR 指南

仓库历史使用 Conventional Commits，例如 `feat: 初始化Open Dev Container扩展，实现容器附加功能`。继续保持这种风格，标题要简短、动词式。

PR 里建议包含：

- 用户可见变化的简要说明
- 你执行过的验证步骤
- UI 改动的截图或录屏
- 关联 issue 或后续事项

## 安全与配置提示

扩展会写入 SSH 配置并调用 Docker，修改附加逻辑时要特别注意：

- 不要提交本机密钥、账号或机器专属路径
- 不要把用户现有 SSH 配置块覆盖掉
- 涉及权限、远程登录和配置写入的改动要重点回归
