#!/usr/bin/env node
/**
 * Next.jsビルド出力内の絶対パスを相対パスに置換するスクリプト
 *
 * npx経由でインストールされた場合、ビルド時のディレクトリへの絶対パスが
 * .next/server/内のファイルに埋め込まれているため、実行時にパス解決エラーが発生する。
 * このスクリプトは、これらの絶対パスを相対パス（./src/...）に置換する。
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const nextServerDir = path.join(projectRoot, '.next', 'server');

/**
 * ディレクトリ内のすべてのJSファイルを再帰的に取得
 */
function getJsFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getJsFiles(fullPath));
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * ファイル内の絶対パスを相対パスに置換
 */
function fixPathsInFile(filePath, buildRoot) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;

  // ビルド時のプロジェクトルートへの絶対パスを相対パスに置換
  // 例: "/path/to/project/src/app/page.tsx" -> "./src/app/page.tsx"
  const escapedBuildRoot = buildRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`"${escapedBuildRoot}/`, 'g');
  content = content.replace(regex, '"./');

  // シングルクォートのパターンも置換
  const regexSingle = new RegExp(`'${escapedBuildRoot}/`, 'g');
  content = content.replace(regexSingle, "'/");

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

/**
 * required-server-files.jsonからビルド時のルートパスを取得
 */
function getBuildRoot() {
  const requiredServerFilesPath = path.join(projectRoot, '.next', 'required-server-files.json');
  if (!fs.existsSync(requiredServerFilesPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(requiredServerFilesPath, 'utf-8');
    const data = JSON.parse(content);
    return data.appDir || null;
  } catch {
    return null;
  }
}

function main() {
  console.log('Fixing Next.js build paths...');

  const buildRoot = getBuildRoot();
  if (!buildRoot) {
    console.log('  No build root found in required-server-files.json, skipping.');
    return;
  }

  // ビルドルートが現在のプロジェクトルートと同じ場合はスキップ
  if (buildRoot === projectRoot) {
    console.log('  Build root matches project root, no fix needed.');
    return;
  }

  console.log(`  Build root: ${buildRoot}`);
  console.log(`  Project root: ${projectRoot}`);

  const jsFiles = getJsFiles(nextServerDir);
  let fixedCount = 0;

  for (const file of jsFiles) {
    if (fixPathsInFile(file, buildRoot)) {
      fixedCount++;
    }
  }

  console.log(`  Fixed paths in ${fixedCount} files.`);

  // required-server-files.jsonも修正
  const requiredServerFilesPath = path.join(projectRoot, '.next', 'required-server-files.json');
  if (fs.existsSync(requiredServerFilesPath)) {
    let content = fs.readFileSync(requiredServerFilesPath, 'utf-8');
    const data = JSON.parse(content);

    data.appDir = projectRoot;
    if (data.config?.outputFileTracingRoot) {
      data.config.outputFileTracingRoot = projectRoot;
    }
    if (data.config?.turbopack?.root) {
      data.config.turbopack.root = projectRoot;
    }

    fs.writeFileSync(requiredServerFilesPath, JSON.stringify(data, null, 2));
    console.log('  Updated required-server-files.json');
  }

  console.log('Done.');
}

main();
