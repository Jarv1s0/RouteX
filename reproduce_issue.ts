
// Mock types
interface ChainItem {
  id: string;
  name: string;
  dialerProxy: string;
  targetProxy: string;
  targetGroups?: string[];
  enabled?: boolean;
}

// Logic copied from local factory.ts (after fix simulation)
async function testInjection() {
  const profile: any = {
    proxies: [
      { name: 'TargetProxy', type: 'ss' }
    ],
    'proxy-groups': [
      {
        name: 'TargetGroup',
        type: 'url-test',
        proxies: ['TargetProxy'] // Will add 'LoopChain' to this group dynamically
      }
    ]
  };

  const chainsConfig = {
    items: [
      {
        // Case 1: Loop Detection
        // Chain -> TargetGroup -> Chain
        id: '1',
        name: 'LoopChain',
        dialerProxy: 'TargetProxy',
        targetProxy: 'TargetGroup',
        targetGroups: ['TargetGroup'], 
        enabled: true
      },
      {
        // Case 2: Provider Dialer
        // Chain -> UnknownDialer -> TargetProxy
        id: '2',
        name: 'ProviderChain',
        dialerProxy: 'UnknownProviderNode', 
        targetProxy: 'TargetProxy',
        targetGroups: [], 
        enabled: true
      }
    ] as ChainItem[]
  };

  console.log('--- Starting Verification Test ---');
  
  try {
      const activeChains = chainsConfig.items;
      const proxies = profile.proxies;
      const proxyGroups = profile['proxy-groups'];

      // --- Loop Detection Logic (matching fixed factory.ts) ---
      const dependencyGraph = new Map<string, Set<string>>();

      // 1. Group -> Proxy
      for (const group of proxyGroups) {
        const name = group.name;
        if (!dependencyGraph.has(name)) dependencyGraph.set(name, new Set());
        group.proxies.forEach((p: string) => dependencyGraph.get(name)?.add(p));
      }

      // 1.5 Proxy -> Dialer
      for (const p of proxies) {
          const name = p.name;
          const dialer = p['dialer-proxy'];
          if (name && dialer) {
              if (!dependencyGraph.has(name)) dependencyGraph.set(name, new Set());
              dependencyGraph.get(name)?.add(dialer);
          }
      }

      for (const chain of activeChains) {
        const { name, dialerProxy, targetGroups } = chain;
        
        // Chain -> Dialer
        if (!dependencyGraph.has(name)) dependencyGraph.set(name, new Set());
        dependencyGraph.get(name)?.add(dialerProxy);

        // Chain -> Target (THE FIX)
        if (!dependencyGraph.has(name)) dependencyGraph.set(name, new Set());
        dependencyGraph.get(name)?.add(chain.targetProxy);

        // Group -> Chain
        if (targetGroups) {
          for (const groupName of targetGroups) {
            if (!dependencyGraph.has(groupName)) dependencyGraph.set(groupName, new Set());
            dependencyGraph.get(groupName)?.add(name);
          }
        }
      }

      const hasLoop = (startNode: string, visited = new Set<string>(), stack = new Set<string>()): boolean => {
        visited.add(startNode);
        stack.add(startNode);

        const neighbors = dependencyGraph.get(startNode);
        if (neighbors) {
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              if (hasLoop(neighbor, visited, stack)) return true;
            } else if (stack.has(neighbor)) {
              return true;
            }
          }
        }

        stack.delete(startNode);
        return false;
      };

      const safeChains = [];
      for (const chain of activeChains) {
        if (hasLoop(chain.name)) {
          console.log(`[PASS] Loop correctly detected for chain "${chain.name}"`);
          continue;
        }
        console.log(`Chain "${chain.name}" is safe.`);
        safeChains.push(chain);
      }

      // Injection Logic
      for (const chain of safeChains) {
        const targetProxyConfig = proxies.find((p) => p.name === chain.targetProxy) || 
                                  proxyGroups.find((g) => g.name === chain.targetProxy); // Simplified find
        
        // We only support Target being PROXY because we need config to clone.
        // But for this test, 'TargetProxy' is a proxy.
        // For 'LoopChain', Target matches 'TargetGroup' (group), so find() might fail depending on logic.
        // But LoopChain should be filtered out by safeChains anyway.
        
        const realTargetConfig = proxies.find(p => p.name === chain.targetProxy);

        if (!realTargetConfig) {
             // If loop detection worked, LoopChain is gone. If ProviderChain, Target is TargetProxy (exists).
             console.log(`Skipping injection (target not found/supported): ${chain.name}`);
             continue;
        }

        // --- Validation Logic (matching fixed factory.ts) ---
        // dialerExists check REMOVED.
        const targetExists = 
            (profile.proxies as any[])?.some(p => p.name === chain.targetProxy) ||
            (profile['proxy-groups'] as any[])?.some(g => g.name === chain.targetProxy);
        
        if (!targetExists) {
             console.log(`Skipping injection (target validation failed): ${chain.name}`);
             continue;
        }

        console.log(`[PASS] Injection successful for chain "${chain.name}" with dialer "${chain.dialerProxy}"`);
      }

  } catch (e) {
      console.error('CRASHED:', e);
  }
}

testInjection();
