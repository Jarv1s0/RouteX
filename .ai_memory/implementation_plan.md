# Implementation Plan - Fix Kernel Switch Download Logic

## Problem
When switching between kernels (e.g., Stable to Alpha) in Settings:
1. App config is updated immediately.
2. App tries to restart core (`stop` -> `start`).
3. If the target kernel is not installed, `start` fails.
4. User attempts to "Update" to fix it, but `updater` relies on the proxy (now stopped).
5. Result: Deadlock.

## Proposed Changes

### 1. Main Process: Add `checkCoreExists` IPC
- Location: `src/main/core/manager.ts` (logic) & `src/main/index.ts` (IPC handler).
- Function: Accept `coreName` ('mihomo' | 'mihomo-alpha'), return `boolean`.
- Implementation: Check `existsSync(mihomoCorePath(coreName))`.

### 2. Renderer Process: Update `mihomo.tsx`
- Location: `src/renderer/src/pages/mihomo.tsx`.
- Handler: `handleCoreChange`.
- Logic:
  ```typescript
  const handleCoreChange = async (newCore) => {
    // 1. Update Config
    await patchAppConfig({ core: newCore });
    
    // 2. Check existence
    const exists = await checkCoreExists(newCore);
    
    if (exists) {
       // Normal restart
       await restartCore();
    } else {
       // Core missing: Trigger Upgrade flow (Download -> Stop -> Start)
       // This uses the *currently running* core for proxying the download.
       const confirm = await showConfirm("内核缺失", "目标内核尚未安装，是否立即下载？");
       if (confirm) {
          await mihomoUpgrade(); // Handles download then restart
       }
    }
    PubSub.publish('mihomo-core-changed');
  }
  ```

## Verification Plan
1. **Manual Test**:
   - Ensure `mihomo-alpha` is NOT installed (delete from `sidecar` if needed).
   - In Settings, switch to "Mihomo Alpha".
   - Should prompt for download.
   - Should download *successfully* (using active Stable proxy).
   - Should restart into Alpha.
