import { app } from 'electron'
import { IS_AUTO_BUILD } from '../../shared/build'

export function getDisplayVersion(): string {
  return IS_AUTO_BUILD ? `${app.getVersion()}-AutoBuild` : app.getVersion()
}
