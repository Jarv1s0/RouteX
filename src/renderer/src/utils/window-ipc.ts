import type { DesktopTitleBarOverlayOptions } from '../../../shared/types/desktop-bridge'
import { C, invokeSafe } from './ipc-core'

export async function showContextMenu(): Promise<void> {
  return invokeSafe(C.showContextMenu)
}

export async function showMainWindow(): Promise<void> {
  return invokeSafe(C.showMainWindow)
}

export async function closeMainWindow(): Promise<void> {
  return invokeSafe(C.closeMainWindow)
}

export async function triggerMainWindow(): Promise<void> {
  return invokeSafe(C.triggerMainWindow)
}

export async function windowMin(): Promise<void> {
  return invokeSafe(C.windowMin)
}

export async function windowMax(): Promise<void> {
  return invokeSafe(C.windowMax)
}

export async function setAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
  return invokeSafe(C.setAlwaysOnTop, alwaysOnTop)
}

export async function isAlwaysOnTop(): Promise<boolean> {
  return invokeSafe(C.isAlwaysOnTop)
}

export async function setTitleBarOverlay(overlay: DesktopTitleBarOverlayOptions): Promise<void> {
  return invokeSafe(C.setTitleBarOverlay, overlay)
}

export async function showTrayIcon(): Promise<void> {
  return invokeSafe(C.showTrayIcon)
}

export async function closeTrayIcon(): Promise<void> {
  return invokeSafe(C.closeTrayIcon)
}

export async function setDockVisible(visible: boolean): Promise<void> {
  return invokeSafe(C.setDockVisible, visible)
}

export async function showFloatingWindow(): Promise<void> {
  return invokeSafe(C.showFloatingWindow)
}

export async function closeFloatingWindow(): Promise<void> {
  return invokeSafe(C.closeFloatingWindow)
}

export async function startMonitor(): Promise<void> {
  return invokeSafe(C.startMonitor)
}
