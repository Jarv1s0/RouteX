// 国家/地区名称到国旗 emoji 的映射
const flagMap: Record<string, string> = {
  // 亚洲
  '香港': '🇭🇰', 'HK': '🇭🇰', 'Hong Kong': '🇭🇰', '港': '🇭🇰',
  '台湾': '🇹🇼', 'TW': '🇹🇼', 'Taiwan': '🇹🇼', '台': '🇹🇼',
  '日本': '🇯🇵', 'JP': '🇯🇵', 'Japan': '🇯🇵', '日': '🇯🇵',
  '韩国': '🇰🇷', 'KR': '🇰🇷', 'Korea': '🇰🇷', '韩': '🇰🇷',
  '新加坡': '🇸🇬', 'SG': '🇸🇬', 'Singapore': '🇸🇬', '狮城': '🇸🇬', '坡': '🇸🇬',
  '马来西亚': '🇲🇾', 'MY': '🇲🇾', 'Malaysia': '🇲🇾', '马来': '🇲🇾',
  '泰国': '🇹🇭', 'TH': '🇹🇭', 'Thailand': '🇹🇭', '泰': '🇹🇭',
  '越南': '🇻🇳', 'VN': '🇻🇳', 'Vietnam': '🇻🇳', '越': '🇻🇳',
  '印度': '🇮🇳', 'IN': '🇮🇳', 'India': '🇮🇳', '印': '🇮🇳',
  '印尼': '🇮🇩', 'ID': '🇮🇩', 'Indonesia': '🇮🇩',
  '菲律宾': '🇵🇭', 'PH': '🇵🇭', 'Philippines': '🇵🇭', '菲': '🇵🇭',
  '土耳其': '🇹🇷', 'TR': '🇹🇷', 'Turkey': '🇹🇷', '土': '🇹🇷',
  '以色列': '🇮🇱', 'IL': '🇮🇱', 'Israel': '🇮🇱',
  '阿联酋': '🇦🇪', 'AE': '🇦🇪', 'UAE': '🇦🇪', 'Dubai': '🇦🇪', '迪拜': '🇦🇪',
  '沙特': '🇸🇦', 'SA': '🇸🇦', 'Saudi': '🇸🇦',
  '巴基斯坦': '🇵🇰', 'PK': '🇵🇰', 'Pakistan': '🇵🇰',
  '孟加拉': '🇧🇩', 'BD': '🇧🇩', 'Bangladesh': '🇧🇩',
  '柬埔寨': '🇰🇭', 'KH': '🇰🇭', 'Cambodia': '🇰🇭',
  '澳门': '🇲🇴', 'MO': '🇲🇴', 'Macau': '🇲🇴', '澳': '🇲🇴',
  
  // 美洲
  '美国': '🇺🇸', 'US': '🇺🇸', 'USA': '🇺🇸', 'United States': '🇺🇸', '美': '🇺🇸',
  '加拿大': '🇨🇦', 'CA': '🇨🇦', 'Canada': '🇨🇦', '加': '🇨🇦',
  '巴西': '🇧🇷', 'BR': '🇧🇷', 'Brazil': '🇧🇷',
  '阿根廷': '🇦🇷', 'AR': '🇦🇷', 'Argentina': '🇦🇷',
  '墨西哥': '🇲🇽', 'MX': '🇲🇽', 'Mexico': '🇲🇽',
  '智利': '🇨🇱', 'CL': '🇨🇱', 'Chile': '🇨🇱',
  '哥伦比亚': '🇨🇴', 'CO': '🇨🇴', 'Colombia': '🇨🇴',
  '秘鲁': '🇵🇪', 'PE': '🇵🇪', 'Peru': '🇵🇪',
  
  // 欧洲
  '英国': '🇬🇧', 'UK': '🇬🇧', 'GB': '🇬🇧', 'United Kingdom': '🇬🇧', '英': '🇬🇧',
  '德国': '🇩🇪', 'DE': '🇩🇪', 'Germany': '🇩🇪', '德': '🇩🇪',
  '法国': '🇫🇷', 'FR': '🇫🇷', 'France': '🇫🇷', '法': '🇫🇷',
  '荷兰': '🇳🇱', 'NL': '🇳🇱', 'Netherlands': '🇳🇱', '荷': '🇳🇱',
  '俄罗斯': '🇷🇺', 'RU': '🇷🇺', 'Russia': '🇷🇺', '俄': '🇷🇺',
  '意大利': '🇮🇹', 'IT': '🇮🇹', 'Italy': '🇮🇹', '意': '🇮🇹',
  '西班牙': '🇪🇸', 'ES': '🇪🇸', 'Spain': '🇪🇸', '西': '🇪🇸',
  '瑞士': '🇨🇭', 'CH': '🇨🇭', 'Switzerland': '🇨🇭',
  '瑞典': '🇸🇪', 'SE': '🇸🇪', 'Sweden': '🇸🇪',
  '挪威': '🇳🇴', 'NO': '🇳🇴', 'Norway': '🇳🇴',
  '芬兰': '🇫🇮', 'FI': '🇫🇮', 'Finland': '🇫🇮',
  '丹麦': '🇩🇰', 'DK': '🇩🇰', 'Denmark': '🇩🇰',
  '波兰': '🇵🇱', 'PL': '🇵🇱', 'Poland': '🇵🇱',
  '乌克兰': '🇺🇦', 'UA': '🇺🇦', 'Ukraine': '🇺🇦',
  '奥地利': '🇦🇹', 'AT': '🇦🇹', 'Austria': '🇦🇹',
  '比利时': '🇧🇪', 'BE': '🇧🇪', 'Belgium': '🇧🇪',
  '爱尔兰': '🇮🇪', 'IE': '🇮🇪', 'Ireland': '🇮🇪',
  '葡萄牙': '🇵🇹', 'PT': '🇵🇹', 'Portugal': '🇵🇹',
  '希腊': '🇬🇷', 'GR': '🇬🇷', 'Greece': '🇬🇷',
  '捷克': '🇨🇿', 'CZ': '🇨🇿', 'Czech': '🇨🇿',
  '罗马尼亚': '🇷🇴', 'RO': '🇷🇴', 'Romania': '🇷🇴',
  '匈牙利': '🇭🇺', 'HU': '🇭🇺', 'Hungary': '🇭🇺',
  '保加利亚': '🇧🇬', 'BG': '🇧🇬', 'Bulgaria': '🇧🇬',
  '卢森堡': '🇱🇺', 'LU': '🇱🇺', 'Luxembourg': '🇱🇺',
  '冰岛': '🇮🇸', 'IS': '🇮🇸', 'Iceland': '🇮🇸',
  
  // 大洋洲
  '澳大利亚': '🇦🇺', 'AU': '🇦🇺', 'Australia': '🇦🇺', '澳洲': '🇦🇺',
  '新西兰': '🇳🇿', 'NZ': '🇳🇿', 'New Zealand': '🇳🇿',
  
  // 非洲
  '南非': '🇿🇦', 'ZA': '🇿🇦', 'South Africa': '🇿🇦',
  '埃及': '🇪🇬', 'EG': '🇪🇬', 'Egypt': '🇪🇬',
  '尼日利亚': '🇳🇬', 'NG': '🇳🇬', 'Nigeria': '🇳🇬',
  '肯尼亚': '🇰🇪', 'KE': '🇰🇪', 'Kenya': '🇰🇪',
}

/**
 * 根据节点名称获取国旗 emoji
 * @param name 节点名称
 * @returns 国旗 emoji，如果没有匹配则返回空字符串
 */
export function getFlag(name: string): string {
  // 先移除可能存在的不可见 flag emoji，再进行解析
  const cleanedName = removeFlag(name)
  const upperName = cleanedName.toUpperCase()
  
  // 按 key 长度降序排列，确保 "USA" 优先于 "SA"、"United States" 优先于 "US" 等
  const sortedEntries = Object.entries(flagMap).sort((a, b) => b[0].length - a[0].length)
  
  for (const [key, flag] of sortedEntries) {
    if (cleanedName.includes(key) || upperName.includes(key.toUpperCase())) {
      return flag
    }
  }
  
  return ''
}

/**
 * 在节点名称前添加国旗
 * @param name 节点名称
 * @returns 带国旗的节点名称
 */
export function addFlag(name: string): string {
  const flag = getFlag(name)
  return flag ? `${flag} ${name}` : name
}

/**
 * 移除节点名称中的国旗 emoji
 * @param name 节点名称
 * @returns 不带国旗的节点名称
 */
export function removeFlag(name: string): string {
  const flagEmojis = Object.values(flagMap)
  let result = name
  for (const emoji of flagEmojis) {
    result = result.replace(emoji, '').trim()
  }
  return result
}

/**
 * 移除节点名称中冗余的英文代码前缀（如 HK香港 -> 香港, HKG香港02 -> 香港02）
 * @param name 节点名称
 * @returns 精简后的节点名称
 */
export function cleanNodeName(name: string): string {
  // 先移除可能存在的不可见 flag emoji 字符
  let cleaned = removeFlag(name)
  // 再匹配并移除英文/数字前缀（如 HK香港 -> 香港, USA美国02 -> 美国02）
  cleaned = cleaned.replace(/^[A-Za-z0-9\s\-_]+(?=[\u4e00-\u9fa5])/g, '').trim()
  return cleaned || name // 如果清理后为空，返回原始名称
}
