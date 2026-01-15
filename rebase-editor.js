const fs = require('fs');
const file = process.argv[2];
let content = fs.readFileSync(file, 'utf8');

// 将涉及我们需要重命名的近期提交指令从 'pick' 改为 'reword'
// 为了简单起见，我们将所有 pick 替换为 reword，反正是脚本自动替换，不耽误真实时间
content = content.replace(/^pick /gm, 'reword ');

fs.writeFileSync(file, content);
