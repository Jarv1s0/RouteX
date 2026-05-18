export const MIHOMO_V119_YAML_SNIPPETS = [
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
  }
] as const
