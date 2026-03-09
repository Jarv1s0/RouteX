
const dependencyGraph = new Map();

// 模拟 Profile 数据: 
// 存在一个普通代理 'ProxyB'，它设置了 dialer-proxy 为 'ChainA'
// 存在一个代理链 'ChainA'，它设置了 dialer-proxy 为 'ProxyB'
const profile = {
  proxies: [
    { name: 'ProxyB', type: 'ss', 'dialer-proxy': 'ChainA' }
  ],
  'proxy-groups': []
};

// 模拟 Chains 配置
const chainsConfig = {
  items: [
    { name: 'ChainA', dialerProxy: 'ProxyB', targetProxy: 'Target', enabled: true }
  ]
};

// --- 当前代码逻辑模拟 ---

const proxies = profile.proxies;
const proxyGroups = profile['proxy-groups'];

// 1. 添加现有的策略组依赖
for (const group of proxyGroups) {
  const name = group.name;
  if (!name) continue;
  if (!dependencyGraph.has(name)) dependencyGraph.set(name, new Set());
  
  if (Array.isArray(group.proxies)) {
    group.proxies.forEach((p) => dependencyGraph.get(name)?.add(p));
  }
}

// FIX: scan existing proxies for dialer-proxy
if (Array.isArray(proxies)) {
  for (const p of proxies) {
    const name = p.name;
    const dialer = p['dialer-proxy'];
    if (name && dialer) {
        if (!dependencyGraph.has(name)) dependencyGraph.set(name, new Set());
        dependencyGraph.get(name)?.add(dialer);
    }
  }
}

// 2. 筛选活跃的代理链并构建潜在依赖
const activeChains = chainsConfig.items.filter(
  (c) => c.enabled !== false && c.name && c.targetProxy && c.dialerProxy
);

for (const chain of activeChains) {
  const { name, dialerProxy, targetGroups } = chain;
  
  // Chain -> Dialer
  if (!dependencyGraph.has(name)) dependencyGraph.set(name, new Set());
  dependencyGraph.get(name)?.add(dialerProxy);

  // Group -> Chain
  if (targetGroups && Array.isArray(targetGroups)) {
    for (const groupName of targetGroups) {
      if (!dependencyGraph.has(groupName)) dependencyGraph.set(groupName, new Set());
      dependencyGraph.get(groupName)?.add(name);
    }
  }
}

// 3. DFS 检测环路
const hasLoop = (startNode, visited = new Set(), stack = new Set()) => {
  visited.add(startNode);
  stack.add(startNode);

  const neighbors = dependencyGraph.get(startNode);
  if (neighbors) {
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasLoop(neighbor, visited, stack)) return true;
      } else if (stack.has(neighbor)) {
        return true; // Cycle detected
      }
    }
  }

  stack.delete(startNode);
  return false;
};

// 运行检测
console.log("Graph Nodes:", [...dependencyGraph.keys()]);
// ChainA points to ProxyB. 
// BUT ProxyB has NO edges in the current graph because 'proxies' were skipped!

for (const chain of activeChains) {
  if (hasLoop(chain.name)) {
    console.log(`PASS: Loop detected for ${chain.name}`);
  } else {
    console.log(`FAIL: No Loop detected for ${chain.name} (Expected Loop!)`);
  }
}
