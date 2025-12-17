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
  // 确保版本号是纯数字格式
  const parts = current.split('.').map(Number);
  
  // 验证版本号格式
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid current version format: ${current}`);
  }
  
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
      } else {
        throw new Error(`Invalid version type: ${type}`);
      }
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
    console.log('🚀 Starting release process...\n');

    // Check if working directory is clean
    try {
      execSync('git diff-index --quiet HEAD --', { stdio: 'pipe' });
    } catch (error) {
      console.error('❌ Working directory is not clean, please commit or stash changes');
      process.exit(1);
    }

    // Get current version
    const currentVersion = getCurrentVersion();
    console.log(`📦 Current version: ${currentVersion}`);

    // Calculate new version
    let newVersion = calculateNewVersion(currentVersion, versionType);
    
    if (isPrerelease) {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '');
      const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      newVersion += `-${branch}.${timestamp}`;
    }

    console.log(`🎯 New version: ${newVersion}`);

    if (isDryRun) {
      console.log('\n🔍 This is a dry run, no actual operations will be performed');
    }

    // Update version
    console.log('\n📝 Updating package.json...');
    if (!isDryRun) {
      updateVersion(newVersion);
    }

    // Commit version changes
    console.log('📤 Committing version changes...');
    run(`git add package.json`);
    run(`git commit -m "chore: bump version to ${newVersion}"`);

    // Create tag
    const tagName = `v${newVersion}`;
    console.log(`🏷️  Creating tag: ${tagName}`);
    run(`git tag -a ${tagName} -m "Release ${tagName}"`);

    // Push to remote
    console.log('🚀 Pushing to remote repository...');
    run('git push');
    run(`git push origin ${tagName}`);

    console.log(`\n✅ Release completed!`);
    console.log(`📋 Version: ${newVersion}`);
    console.log(`🏷️  Tag: ${tagName}`);
    console.log(`🔗 GitHub Actions will build and release: https://github.com/${getRepoInfo()}/actions`);

  } catch (error) {
    console.error('❌ Release failed:', error.message);
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
🚀 Auto Release Script

Usage:
  node scripts/release.js [version-type] [options]

Version Types:
  patch     Patch version (default) - 1.0.0 -> 1.0.1
  minor     Minor version - 1.0.0 -> 1.1.0  
  major     Major version - 1.0.0 -> 2.0.0
  x.y.z     Specific version number

Options:
  --pre, --prerelease    Create prerelease version
  --dry-run             Dry run, no actual operations
  --help, -h            Show help

Examples:
  node scripts/release.js patch              # Release patch version
  node scripts/release.js minor --pre        # Release prerelease minor version
  node scripts/release.js 2.0.0             # Release specific version
  node scripts/release.js --dry-run          # Dry run
`);
}

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
} else {
  main();
}