import { getHash } from './hash';

const testString = 'hello world';
const expectedHash = '5eb63bbbe01eeed093cb22bb8f5acdc3'; // MD5 of 'hello world'

const result = getHash(testString);

if (result === expectedHash) {
    console.log('✅ Hash verification passed!');
    console.log(`Input: "${testString}"`);
    console.log(`Output: ${result}`);
    process.exit(0);
} else {
    console.error('❌ Hash verification failed!');
    console.error(`Expected: ${expectedHash}`);
    console.error(`Actual:   ${result}`);
    process.exit(1);
}
