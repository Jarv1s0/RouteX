#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 获取命令行参数
const args = process.argv.slice(2);
const versionType = args[0] || 'patch'; // patch, minor, major, or specific version
const isPrerelease = args.includes('--pre') || args.includes('--prerelease');
const isDryRun = args.includes('--dry-run');

function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  return packageJson.version;
}

function updateVersion(newVersion) {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
}

function calculateNewVersion(current, type) {
  const parts = current.split('.').map(Number);
  
  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    default:
      // 如果是具体版本号
      if (/^\d+\.\d+\.\d+/.test(type)) {
        return type;
      }
      throw new Error(`Invalid version type: ${type}`);
  }
}

function run(command, options = {}) {
  console.log(`> ${command}`);
  if (!isDryRun) {
    return execSync(command, { stdio: 'inherit', ...options });
  }
}

function main() {
  try {
    console.log('🚀 开始发布流程...\n');

    // 检查工作目录是否干净
    try {
      execSync('git diff-index --quiet HEAD --', { stdio: 'pipe' });
    } catch (error) {
      console.error('❌ 工作目录不干净，请先提交或暂存更改');
      process.exit(1);
    }

    // 获取当前版本
    const currentVersion = getCurrentVersion();
    console.log(`📦 当前版本: ${currentVersion}`);

    // 计算新版本
    let newVersion = calculateNewVersion(currentVersion, versionType);
    
    if (isPrerelease) {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '');
      const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      newVersion += `-${branch}.${timestamp}`;
    }

    console.log(`🎯 新版本: ${newVersion}`);

    if (isDryRun) {
      console.log('\n🔍 这是一次试运行，不会执行实际操作');
    }

    // 更新版本号
    console.log('\n📝 更新 package.json...');
    if (!isDryRun) {
      updateVersion(newVersion);
    }

    // 提交版本更改
    console.log('📤 提交版本更改...');
    run(`git add package.json`);
    run(`git commit -m "chore: bump version to ${newVersion}"`);

    // 创建标签
    const tagName = `v${newVersion}`;
    console.log(`🏷️  创建标签: ${tagName}`);
    run(`git tag -a ${tagName} -m "Release ${tagName}"`);

    // 推送到远程
    console.log('🚀 推送到远程仓库...');
    run('git push');
    run(`git push origin ${tagName}`);

    console.log(`\n✅ 发布完成！`);
    console.log(`📋 版本: ${newVersion}`);
    console.log(`🏷️  标签: ${tagName}`);
    console.log(`🔗 GitHub Actions 将自动构建和发布: https://github.com/${getRepoInfo()}/actions`);

  } catch (error) {
    console.error('❌ 发布失败:', error.message);
    process.exit(1);
  }
}

function getRepoInfo() {
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
    return match ? match[1] : 'your-username/your-repo';
  } catch {
    return 'your-username/your-repo';
  }
}

function showHelp() {
  console.log(`
🚀 自动发布脚本

用法:
  node scripts/release.js [version-type] [options]

版本类型:
  patch     补丁版本 (默认) - 1.0.0 -> 1.0.1
  minor     次要版本 - 1.0.0 -> 1.1.0  
  major     主要版本 - 1.0.0 -> 2.0.0
  x.y.z     指定版本号

选项:
  --pre, --prerelease    创建预发布版本
  --dry-run             试运行，不执行实际操作
  --help, -h            显示帮助

示例:
  node scripts/release.js patch              # 发布补丁版本
  node scripts/release.js minor --pre        # 发布预发布次要版本
  node scripts/release.js 2.0.0             # 发布指定版本
  node scripts/release.js --dry-run          # 试运行
`);
}

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
} else {
  main();
}