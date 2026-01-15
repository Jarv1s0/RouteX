const fs = require('fs');
const file = process.argv[2];
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  ['fix(traffic): 修复订阅流量统计异常并支持自定义结算日', 'fix(traffic): resolve subscription traffic calculation and support custom reset day'],
  ['fix: 修复托盘图标在 2K 屏幕上模糊的问题', 'fix(tray): resolve blurry tray icon on high DPI screens'],
  ['feat: UI/性能优化 - 连接详情卡片重构、柱状图渐变、闭包修复、Sub-Store启用开关', 'feat(ui): refactor connection card, add traffic chart gradients and sub-store switch'],
  ['perf: optimization runtime performance and vite build chunks', 'perf(core): optimize runtime performance and build chunks'],
  ['fix: MRS格式IPCIDR规则集预览 + style: 优化代理组Live指示器样式', 'fix(proxy): add MRS format IPCIDR preview and optimize live indicator style'],
  ['refactor: IPC模块化 + removeAllListeners系统性修复 + 代码质量优化', 'refactor(ipc): modularize IPC events, fix listeners cleanup, and optimize code quality'],
  ['feat/opt(tools): refactor IP probe panel & refine topology anim, code cleanups', 'refactor(tools): refactor IP probe panel, refine topology animation'],
  ['解决图块内存限制超标', 'fix(perf): resolve map tile memory limit exceeded'],
  ['feat(ui): 优化网络拓扑图展示与交互', 'feat(ui): enhance network topology map display and interactions'],
  ['fix: 修复规则列表和覆写列表刷新延迟，优化新建规则弹窗 UI', 'fix(ui): resolve rule list refresh delay and optimize rule modal'],
  ['perf(ui): optimize context menu and create rule button style', 'perf(ui): optimize context menu and rule button style'],
  ['fix: checkout sha instead of tag to avoid sync issues', 'fix(ci): checkout sha instead of tag to avoid sync issues'],
  ['fix: use commit sha as release target', 'fix(ci): use commit sha as release target'],
  ['chore: optimize autobuild workflow and revert ui changes', 'chore(ci): optimize autobuild workflow and revert ui changes'],
  ['feat: add kernel update notification and UI improvements', 'feat(core): add kernel update notification and UI improvements'],
  ['feat: add topology map and fix external controller settings', 'feat(map): add topology map and fix external controller settings'],
  ['fix: duplicate identifier in ipc.ts', 'fix(ipc): duplicate identifier in ipc.ts'],
  ['feat: implement MRS rule preview support', 'feat(proxy): implement MRS rule preview support'],
  ['fix: handle pipe access denied error and include chains in webdav backup', 'fix(core): handle pipe access denied and include chains in backup'],
  ['fix: resolve proxy chain validation issues and improve loop detection', 'fix(core): resolve chain validation issues and improve loop detection'],
  ['feat: optimize connection detail page layout and features', 'feat(ui): optimize connection detail page layout and features'],
  ['fix: resolve syntax error in menu configuration', 'fix(menu): resolve syntax error in menu configuration'],
  ['feat: 重新设计设置页面布局和UI优化', 'feat(ui): redesign settings page layout and UI optimization'],
  ['Update AUR backup', 'chore(aur): update AUR backup'],
  ['fix: 修复规则数量统计不准确问题，优化托盘图标高DPI支持', 'fix(core): resolve rule count accuracy and optimize tray icon for high DPI'],
  ['restore monaco editor plugin with node v25 compatibility patch', 'fix(deps): restore monaco editor plugin with node v25 compatibility patch'],
  ['Migrate NextUI to HeroUI', 'refactor(ui): migrate NextUI to HeroUI']
];

let lines = content.split('\\n');
if (lines.length > 0) {
    let titleLine = lines[0];
    
    // 如果是裸的 init project
    if (titleLine.trim() === 'init project') {
        titleLine = 'chore: init project';
    }

    for (const [oldStr, newStr] of replacements) {
        if (titleLine.includes(oldStr)) {
            titleLine = titleLine.replace(oldStr, newStr);
        }
    }
    lines[0] = titleLine;
    content = lines.join('\\n');
    fs.writeFileSync(file, content);
}
