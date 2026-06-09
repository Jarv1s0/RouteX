export const MIHOMO_V11927_YAML_SNIPPETS = [
  {
    label: 'mihomo-tailscale-proxy',
    detail: 'Tailscale outbound',
    info: 'Insert a Mihomo Tailscale outbound template.',
    snippet: `- name: \${name}
  type: tailscale
  hostname: \${hostname}
  auth-key: \${auth_key}
  state-dir: \${state_dir}
  udp: true
  accept-routes: true
  exit-node: \${exit_node}
  exit-node-allow-lan-access: true`
  },
  {
    label: 'mihomo-openvpn-proxy',
    detail: 'OpenVPN outbound',
    info: 'Insert a Mihomo OpenVPN outbound template.',
    snippet: `- name: \${name}
  type: openvpn
  server: \${server}
  port: \${port}
  proto: udp
  dev: tun
  cipher: AES-256-GCM
  auth: SHA256
  ca: |
    \${ca_pem}
  cert: |
    \${cert_pem}
  key: |
    \${key_pem}
  username: \${username}
  password: \${password}
  ping: 10
  ping-restart: 60
  mtu: 1500
  udp: true`
  },
  {
    label: 'mihomo-gost-relay-proxy',
    detail: 'GOST relay outbound',
    info: 'Insert a Mihomo GOST relay outbound template.',
    snippet: `- name: \${name}
  type: gost-relay
  server: \${server}
  port: \${port}
  username: \${username}
  password: \${password}
  tls: true
  sni: \${sni}
  mux: true
  udp: true
  skip-cert-verify: false`
  },
  {
    label: 'mihomo-empty-fallback-group',
    detail: 'Proxy group empty fallback',
    info: 'Insert a proxy group template with empty-fallback.',
    snippet: `- name: \${group_name}
  type: select
  use:
    - \${provider_name}
  empty-fallback: \${fallback_proxy}`
  },
  {
    label: 'mihomo-pass-rule',
    detail: 'PASS-RULE target',
    info: 'Insert a rule using the built-in PASS-RULE target.',
    snippet: `- \${rule_type},\${rule_payload},PASS-RULE`
  },
  {
    label: 'mihomo-age-proxy-provider',
    detail: 'Age encrypted proxy provider',
    info: 'Insert a proxy provider template with age-secret-key.',
    snippet: `\${provider_name}:
  type: http
  url: \${provider_url}
  path: ./providers/\${provider_name}.yaml
  interval: 3600
  age-secret-key: \${age_secret_key}
  health-check:
    enable: true
    url: https://www.gstatic.com/generate_204
    interval: 300`
  },
  {
    label: 'mihomo-bundle-rule-provider',
    detail: 'Bundle rule provider',
    info: 'Insert a rule provider template with path-in-bundle.',
    snippet: `\${provider_name}:
  type: http
  behavior: classical
  format: mrs
  url: \${bundle_url}
  path: ./rules/\${bundle_file}
  path-in-bundle: \${inner_rule_path}
  interval: 86400`
  },
  {
    label: 'mihomo-vless-listener-insecure',
    detail: 'VLESS listener allow-insecure',
    info: 'Insert a VLESS listener template with allow-insecure.',
    snippet: `- name: \${listener_name}
  type: vless
  enable: true
  listen: :\${port}
  users:
    - username: \${username}
      uuid: \${uuid}
  certificate: \${cert_path}
  private-key: \${key_path}
  allow-insecure: true`
  }
] as const

export const MIHOMO_V119_YAML_SNIPPETS = MIHOMO_V11927_YAML_SNIPPETS
