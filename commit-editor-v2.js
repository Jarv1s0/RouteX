const fs = require('fs');
const file = process.argv[2];
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  // 新发现的早期中文与不规范 commit 记录
  ['feat: 全局弹窗样式美化，替换原生 dialog', 'feat(ui): beautify global modal style and replace native dialog'],
  ['fix: 修复安全漏洞和链路预览UI优化', 'fix(ui): resolve security vulnerabilities and optimize chain preview UI'],
  ['chore: 更新版本号为 v1.6.8', 'chore(release): bump version to v1.6.8'],
  ['修复 TypeScript 编译错误：移除未使用的变量', 'fix(core): remove unused variables to resolve typescript compile errors'],
  ['feat: 新增点击代理组卡片时自动测速选项', 'feat(proxy): add auto-speed test option when click proxy group card'],
  ['fix: 增加流量统计定期保存，防止关机时数据丢失', 'fix(stats): add periodic save for traffic stats to prevent data loss'],
  ['fix: 撤回仪表盘改造，恢复统计页面原有布局', 'revert: undo dashboard refactor and restore stats layout'],
  ['feat: v1.7.1 - 日志设置移至日志页面，优化自动测速', 'feat(ui): move log settings to logs page and optimize auto-speed test'],
  ['perf: 优化自动测速逻辑，只在首次进入页面时测速', 'perf(proxy): optimize auto-speed test logic only on first visit'],
  ['fix: 修复订阅统计跨月计算问题，简化实时流量图UI', 'fix(stats): resolve cross-month calculation and simplify traffic chart'],
  ['feat: v1.7.0 - 优化流量图和代理组自动测速', 'feat(ui): optimize traffic chart and proxy group auto-speed test'],
  ['docs: 合并 v1.6.17 到 v1.6.18', 'docs: merge v1.6.17 to v1.6.18'],
  ['fix: 移除未使用的导入', 'fix(core): remove unused imports'],
  ['style: 统一UI样式优化', 'style(ui): unify UI styles'],
  ['fix: 增强白屏检测，窗口显示时自动检测并恢复', 'fix(core): enhance white screen detection and auto-recovery on show'],
  ['fix: 修复多个显示和统计问题', 'fix(ui): resolve multiple display and statistics issues'],
  ['fix: 修复应用重启后今日流量统计清零的问题', 'fix(stats): resolve traffic stats reset on app restart'],
  ['fix: 修复应用重启后今日流量统计错误', 'fix(stats): resolve traffic stats calculation error on app restart'],
  ['fix: 修复未使用的 event 参数编译错误', 'fix(core): remove unused event parameter to fix ts error'],
  ['chore: 更新 changelog 版本号为 v1.6.8', 'chore(docs): bump version to v1.6.8 in changelog'],
  ['fix: 修复长时间运行后白屏问题', 'fix(core): resolve white screen issue after long-running'],
  ['fix: 修复流量统计增量计算错误', 'fix(stats): resolve traffic incremental calculation error'],
  ['feat: 统计页面新增进程流量排行功能', 'feat(stats): add process traffic ranking to stats page'],
  ['统一弹窗关闭按钮样式', 'style(ui): unify modal close button styles'],
  ['连接详情支持选择复制', 'feat(ui): enable selection copy in connection details'],
  ['优化规则页面和日志页面样式', 'style(ui): optimize rules and logs page styles'],
  ['更新 README', 'docs: update README'],
  ['优化连接和规则页面的颜色方案', 'style(ui): optimize color schemes for connections and rules pages'],
  ['fix: 修复订阅自动更新问题并发布 v1.7.2', 'fix(sub): resolve auto-update issue and release v1.7.2'],
  ['chore: 修复 mihomo 页面未使用的导入 TypeScript 错误', 'chore: remove unused imports in mihomo page'],
  ['fix: 升级 qs 修复安全漏洞', 'fix(deps): upgrade qs to resolve security vulnerabilities'],
  ['chore: 删除更多垃圾文件', 'chore: remove extra garbage files'],
  ['chore: 清理垃圾文件', 'chore: clean up garbage files'],
  ['fix: 更改默认测速地址为 cp.cloudflare.com 以解决直连超时问题', 'fix(proxy): change default speed test url to cp.cloudflare.com'],
  ['fix(ui): 修复代理组名称中已有国旗时无法正确显示 Emoji 的问题 (使用 font-family 强制渲染)', 'fix(ui): resolve flag emoji rendering issue in proxy group names with font-family'],
  ['style: 优化国旗 Emoji 字体优先级，修复 Windows 下显示为字母的问题', 'style(ui): optimize flag emoji font priority to fix rendering on Windows'],
  ['fix(ui): 代理组选中的节点现在会显示国旗 (font-family optimized)', 'fix(ui): selected node in proxy group now displays flag emoji'],
  ['fix: 修复 MSR 规则无查看按钮 & 优化 Windows 任务栏图标一致性', 'fix(ui): add MSR rule view button and optimize windows tray icon sync'],
  ['fix(renderer): 修复统计页面重构导致的未使用变量报错 (TS6133)', 'fix(core): remove unused variable after stats page refactor'],
  ['chore(release): v1.8.3 - 性能优化与UI改进 (包含完整 1.8.2 更新内容)', 'chore(release): bump version to v1.8.3 with perf and UX improvements'],
  ['fix: 优化 UI 交互与统计页面性能  - 移除工具页面 IP 纯净度检测卡片 - 优化侧边栏卡片鼠标交互样式 - 修复统计页面高并发连接下的卡死与内存泄漏问题 - 优化统计详情弹窗动画', 'perf(ui): optimize UI interactions and resolve memory leak on stats page'],
  ['feat: 工具页面布局优化 & 精简 changelog', 'feat(ui): optimize tools page layout and simplify changelog'],
  ['fix: 修复代理节点延迟颜色不一致问题 & UI 优化', 'fix(ui): resolve inconsistent proxy latency colors and optimize UI'],
  ['chore: 移除AI缓存文件并更新gitignore', 'chore: remove AI cache files and update gitignore'],
  ['fix: 修复TS编译错误(未使用变量)', 'fix(core): resolve ts compile errors due to unused variables'],
  ['fix: 回滚代理组组件至 v1.8.2', 'fix(ui): rollback proxy group to v1.8.2'],
  ['fix: 修复代理页面自动测速逻辑及添加 workspace 配置', 'fix(proxy): fix auto-speed test logic and add workspace config']
];

let lines = content.split('\\n');
if (lines.length > 0) {
    let titleLine = lines[0];

    // 把以前遗留的直接替换的裸提交或者中英混杂拦截
    let matched = false;
    for (const [oldStr, newStr] of replacements) {
        if (titleLine.includes(oldStr)) {
            titleLine = titleLine.replace(oldStr, newStr);
            matched = true;
            break; // 假设每条只有一个主要匹配
        }
    }

    // 正则表达式匹配去除各种形式的版本号：
    // 匹配如: v1.8.4, 2.1.0, v2.1.1, V2.0.0
    // 以及附带可能有的连字符或空格 例如: "chore(release): v2.1.4" -> "chore(release):"
    titleLine = titleLine.replace(/(^|\\s)(v|V)?\\d+\\.\\d+\\.\\d+(-\\w+(\\.\\d+)?)?/g, '');
    
    // 如果去除版本号后带有连字符 - 或多余的空格，修剪一下
    titleLine = titleLine.replace(/\\s-\\s/g, ' ').replace(/\\s+/g, ' ').trim();
    // 修复可能出现的类似 "chore(release):" 后面什么也没有的情况
    titleLine = titleLine.replace(/:$/g, ': release bump');

    lines[0] = titleLine;
    content = lines.join('\\n');
    fs.writeFileSync(file, content);
}
