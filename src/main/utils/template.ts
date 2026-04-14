import os from 'os'
import { createDefaultAppConfig } from '../../shared/defaults/app'
import {
  createDefaultControledMihomoConfig,
  defaultOverrideConfig,
  defaultProfile,
  defaultProfileConfig
} from '../../shared/defaults/runtime'

export const defaultConfig: AppConfig = createDefaultAppConfig(process.platform, os.release())
export const defaultControledMihomoConfig: Partial<MihomoConfig> =
  createDefaultControledMihomoConfig(process.platform)
export { defaultProfileConfig, defaultOverrideConfig, defaultProfile }
