# 项目规则

## PowerShell 脚本编码（重要！）
- 所有 `.ps1` 文件必须保存为 **UTF-8 with BOM** 编码
- PowerShell 5.1（Windows 默认）不认没有 BOM 的 UTF-8 文件，会把中文注释/字符串读成乱码，报"意外的 token"等语法错误
- 修改 `.ps1` 文件后，如果脚本报解析错误，**首先检查 BOM 是否丢失**
- 修复方法（在 PowerShell 中执行）：
  ```powershell
  $content = [System.IO.File]::ReadAllText('路径\文件.ps1')
  $utf8Bom = New-Object System.Text.UTF8Encoding($true)
  [System.IO.File]::WriteAllText('路径\文件.ps1', $content, $utf8Bom)
  ```
- 注意：TRAE 的 SearchReplace 和 Write 工具可能会丢失 BOM，修改后务必验证

## PowerShell 变量名陷阱
- PowerShell 变量名**不区分大小写**，`$src` 和 `$SRC` 是同一个变量
- 脚本顶部定义了 `$SRC = 'E:\new_workspace\children_study'`（网页源项目路径）
- 在 foreach 循环中读取 Java 文件内容时，**必须用不同名变量**（如 `$javaContent`），绝不能用 `$src`，否则会覆盖全局 `$SRC`
- 否则后续 `Copy-Item "$SRC\css"` 会尝试用 Java 源码当路径，报 DriveNotFoundException

## APK 构建注意事项
- 构建脚本 `fix-and-build.ps1` 第 6 步使用 PowerShell `Copy-Item` 同步网页资源（不用 `cmd /c xcopy`，因为会被安全策略阻止）
- 同步后文件数检查：少于 10 个会报错终止
- `cmd /c` 在当前环境被安全策略阻止，不要用

## 项目结构
- 网页源文件在 `E:\new_workspace\children_study\`（css/ js/ index.html audio/）
- Android 项目在 `E:\new_workspace\children_study_android\`
- APK 打包后自动复制到网页项目根目录
