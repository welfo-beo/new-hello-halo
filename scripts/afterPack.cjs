// ============================================================================
// afterPack hook - Post-packaging cleanup and signing
//
// Runs after electron-builder creates the unpacked app directory.
//
// 1. Remove non-target @parcel/watcher platform packages from the unpacked
//    output. All 4 platform packages exist in node_modules (so every build
//    sees a complete set), but only the target platform's package is needed
//    at runtime. Cleaning here avoids mutating the shared node_modules.
//
// 2. macOS ad-hoc signing (prevents "damaged app" prompts on unsigned builds).
// ============================================================================

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// electron-builder Arch enum: 0=ia32, 1=x64, 2=armv7l, 3=arm64, 4=universal
const ARCH_NAMES = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64', 4: 'universal' };

// Maps platform-arch to the @parcel/watcher package name to KEEP.
// Everything else under @parcel/watcher-* gets removed.
const WATCHER_TARGETS = {
  'darwin-arm64': 'watcher-darwin-arm64',
  'darwin-x64':   'watcher-darwin-x64',
  'win32-x64':    'watcher-win32-x64',
  'linux-x64':    'watcher-linux-x64-glibc',
};

/**
 * Resolve the app.asar.unpacked directory from electron-builder context.
 *
 * macOS:       <appOutDir>/<ProductName>.app/Contents/Resources/app.asar.unpacked
 * win32/linux: <appOutDir>/resources/app.asar.unpacked
 */
function getUnpackedDir(context) {
  if (context.electronPlatformName === 'darwin') {
    const appName = context.packager.appInfo.productFilename;
    return path.join(context.appOutDir, `${appName}.app`, 'Contents', 'Resources', 'app.asar.unpacked');
  }
  return path.join(context.appOutDir, 'resources', 'app.asar.unpacked');
}

/**
 * Remove non-target @parcel/watcher-* packages from the unpacked output.
 */
function cleanNonTargetWatchers(context) {
  const platform = context.electronPlatformName;
  const archStr = ARCH_NAMES[context.arch] || String(context.arch);
  const key = `${platform}-${archStr}`;
  const targetPkg = WATCHER_TARGETS[key];

  if (!targetPkg) {
    console.warn(`[afterPack] No watcher mapping for ${key}, skipping cleanup`);
    return;
  }

  const unpackedDir = getUnpackedDir(context);
  const parcelDir = path.join(unpackedDir, 'node_modules', '@parcel');

  if (!fs.existsSync(parcelDir)) {
    console.log(`[afterPack] No @parcel dir in unpacked output, skipping cleanup`);
    return;
  }

  const entries = fs.readdirSync(parcelDir, { withFileTypes: true });
  const removed = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith('watcher-')) continue;
    if (entry.name === targetPkg) continue;

    const fullPath = path.join(parcelDir, entry.name);
    fs.rmSync(fullPath, { recursive: true });
    removed.push(entry.name);
  }

  if (removed.length > 0) {
    console.log(`[afterPack] ${key}: removed ${removed.length} non-target watcher(s): ${removed.join(', ')}`);
  }
  console.log(`[afterPack] ${key}: keeping @parcel/${targetPkg}`);
}

/**
 * Remove non-target platform binaries from @anthropic-ai packages.
 * These packages ship vendor binaries for all platforms but only the
 * current platform's files actually exist on disk. Missing paths cause
 * 7zip to fail during NSIS packaging on Windows.
 */
function cleanNonTargetVendorBinaries(context) {
  const platform = context.electronPlatformName;
  if (platform !== 'win32') return;

  const unpackedDir = getUnpackedDir(context);
  const pkgs = ['@anthropic-ai/claude-agent-sdk', '@anthropic-ai/claude-code'];

  for (const pkg of pkgs) {
    const pkgDir = path.join(unpackedDir, 'node_modules', ...pkg.split('/'));
    if (!fs.existsSync(pkgDir)) continue;

    // Remove non-win32 ripgrep vendor dirs
    const ripgrepDir = path.join(pkgDir, 'vendor', 'ripgrep');
    if (fs.existsSync(ripgrepDir)) {
      for (const entry of fs.readdirSync(ripgrepDir, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.includes('win32')) {
          fs.rmSync(path.join(ripgrepDir, entry.name), { recursive: true, force: true });
        }
      }
      // Remove COPYING if it's a broken ref
      const copying = path.join(ripgrepDir, 'COPYING');
      if (!fs.existsSync(copying)) {
        try { fs.unlinkSync(copying); } catch {}
      }
    }

    // Remove wasm files that don't exist (broken refs)
    for (const f of fs.readdirSync(pkgDir)) {
      if (f.endsWith('.wasm')) {
        const full = path.join(pkgDir, f);
        try { fs.accessSync(full); } catch { try { fs.unlinkSync(full); } catch {} }
      }
    }

    console.log(`[afterPack] Cleaned non-target binaries from ${pkg}`);
  }
}

module.exports = async function(context) {
  // Clean non-target watcher packages from unpacked output
  cleanNonTargetWatchers(context);

  // Clean non-target vendor binaries from @anthropic-ai packages
  cleanNonTargetVendorBinaries(context);

  // macOS ad-hoc signing (other platforms skip)
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const entitlementsPath = path.join(__dirname, '..', 'resources', 'entitlements.mac.plist');

  console.log(`[afterPack] Professional ad-hoc signing: ${appPath}`);

  try {
    // 1. Remove quarantine attribute (if exists)
    try {
      execSync(`xattr -dr com.apple.quarantine "${appPath}"`, { stdio: 'pipe' });
    } catch { }

    // 2. Ad-hoc sign with entitlements
    const codesignCmd = `codesign --force --deep -s - --entitlements "${entitlementsPath}" --timestamp=none "${appPath}"`;
    console.log(`[afterPack] Executing: ${codesignCmd}`);
    execSync(codesignCmd, { stdio: 'inherit' });

    // 3. Verify signature
    console.log('[afterPack] Verifying signature...');
    const verifyOutput = execSync(`codesign -dv "${appPath}" 2>&1`, { encoding: 'utf8' });
    console.log(verifyOutput);

    console.log('[afterPack] Ad-hoc signing complete');
  } catch (error) {
    console.error('[afterPack] Signing failed:', error.message);
    // Don't throw error, let build continue
  }
};
