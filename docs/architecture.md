# 架构说明

## 背景

Open Dev Container 面向支持 Remote SSH 的 VS Code 兼容编辑器。当前实现不直接实现完整远端 authority，而是把正在运行的 Docker 容器伪装成一个 SSH 主机，再交给编辑器已有的 Remote SSH 链路打开工作区。

这个方案的第一阶段目标是稳定、可维护、容易诊断：

- Docker 负责容器发现和 `docker exec`。
- 扩展负责在容器内准备最小 SSH 入口。
- Remote SSH 负责最终打开工作区。

## 为什么暂不做完整 Dev Containers

完整 Dev Containers 能力通常分两层：

- 容器生命周期：解析 `.devcontainer/devcontainer.json`、构建镜像、启动 Compose、执行生命周期命令。
- 编辑器远端连接：在容器内安装并启动编辑器 server，再把本地窗口连接进去。

第二层依赖更深的编辑器远端 API、server 分发和版本匹配策略。当前仓库先交付稳定的 Remote SSH 桥接方案，再逐步补 Dev Containers 相关能力。

## 当前链路

1. 使用 `docker ps --format '{{json .}}'` 获取运行中的容器。
2. 在扩展全局存储中生成专用 SSH key。
3. 在目标容器里准备 `sshd`；必要且允许时安装 `openssh-server`。
4. 把公钥写入容器用户的 `authorized_keys`。
5. 在本机 SSH config 写入受管理的 Host 配置块。
6. 通过 `vscode-remote://ssh-remote+<host>/<workspace>` 打开容器内工作区。

示例配置：

```sshconfig
# >>> open-dev-container odc-<name>-<id6>
Host odc-<name>-<id6>
  HostName 127.0.0.1
  User root
  IdentityFile <extension-global-storage>/open_dev_container_ed25519
  ProxyCommand docker exec -i -u 0 <container-id> /usr/sbin/sshd -i -f /tmp/open-dev-container/sshd_config
# <<< open-dev-container odc-<name>-<id6>
```

Host alias 使用 `odc-<name>-<id6>`，这样 Remote SSH 状态栏不会显示过长的扩展名前缀，同时仍保留容器名和短 ID 用于区分连接。

生成的 `sshd_config` 使用一个 `ForceCommand` 保活包装，避免非 tty 的 Remote SSH 会话过早退出。

## 代码结构

当前代码已从单一入口拆分为几个边界清晰的模块：

- `src/extension.ts`：VS Code API、命令注册、树视图和主流程编排。
- `src/dockerClient.ts`：Docker CLI 调用与 Docker JSON 输出解析。
- `src/sshConfig.ts`：SSH config 标记块写入、替换和清理。
- `src/containerProvisioner.ts`：容器内 sshd 准备脚本生成与错误解析。
- `src/recentConnections.ts`：最近连接的读取、保存、去重、删除和损坏数据过滤。
- `src/errors.ts`、`src/fileSystem.ts`、`src/utils.ts`：错误类型、文件操作和纯工具函数。

这种拆分让 Docker 解析、SSH config 处理、路径推断和 recent 存储可以用 Node 单元测试直接覆盖，不需要启动扩展宿主。

## 当前边界

当前版本暂不负责：

- 解析 `.devcontainer/devcontainer.json`
- `docker-compose` 启动
- `@devcontainers/cli` 集成
- 生命周期命令执行
- 原生 `dev-container` resolver

## 测试策略

仓库使用 Node 内置测试框架，测试入口是：

```bash
npm test
```

当前测试覆盖：

- Docker `ps` 和 `inspect` 输出解析。
- SSH config 标记块 upsert、单个删除和全部删除。
- SSH config value 转义。
- bind mount 工作目录推断。
- Host alias、remote user 校验和 mount 摘要。
- 最近连接过滤、排序、去重和删除。
- 容器 sshd 准备脚本关键分支。

改动后至少执行 `npm test`。涉及真实容器、Remote SSH 和编辑器窗口打开的改动，还需要在扩展宿主里手动验证 Attach、Reconnect、Disconnect 和 Clean SSH Config。

## VSIX 版本管理

`infra.sh pack` 会读取 `package.json` 的 `name` 和 `version`，输出：

```text
dist/open-dev-container-<version>.vsix
```

也就是说 VSIX 版本由 `package.json.version` 管理。发布新包前先 bump 版本号，再执行：

```bash
npm run pack
```

这样每次产物都会带版本号，例如：

```text
dist/open-dev-container-0.0.1.vsix
dist/open-dev-container-0.0.2.vsix
dist/open-dev-container-0.1.0.vsix
```
