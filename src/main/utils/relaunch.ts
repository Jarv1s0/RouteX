import { spawn } from 'child_process'

export function customRelaunch(pid: number, argv: string[]): void {
  const script = `while kill -0 ${pid} 2>/dev/null; do
  sleep 0.1
done
${argv.join(' ')} & disown
exit
`

  spawn('sh', ['-c', `"${script}"`], {
    shell: true,
    detached: true,
    stdio: 'ignore'
  })
}
