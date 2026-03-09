
import { addFlag, removeFlag, getFlag } from './flags'

const testCases = [
  '美国 01',
  '美国 02',
  'Hong Kong 01',
  'Japan',
  '🇺🇸 美国 01'
]

console.log('--- Testing addFlag ---')
testCases.forEach(name => {
  console.log(`'${name}' -> '${addFlag(name)}'`)
})

console.log('\n--- Testing removeFlag ---')
testCases.forEach(name => {
  console.log(`'${name}' -> '${removeFlag(name)}'`)
})
