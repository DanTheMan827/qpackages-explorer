import assert from 'node:assert/strict';
import { selectApiTransport } from '../src/lib/apiTransport.ts';

const cases = [
  {
    name: 'qpackages.com is always direct, even for a Wrangler build',
    input: { hostname: 'qpackages.com', isViteDev: false, buildProxyMode: 'worker' },
    expected: 'direct',
  },
  {
    name: 'qpackages.com is always direct, even during Vite development',
    input: { hostname: 'qpackages.com', isViteDev: true, buildProxyMode: 'auto' },
    expected: 'direct',
  },
  {
    name: 'Vite development uses the Vite proxy',
    input: { hostname: 'localhost', isViteDev: true, buildProxyMode: 'auto' },
    expected: 'vite-proxy',
  },
  {
    name: 'Wrangler builds use the same-origin Worker proxy',
    input: { hostname: 'qpackages-explorer.example.workers.dev', isViteDev: false, buildProxyMode: 'worker' },
    expected: 'worker-proxy',
  },
  {
    name: 'ordinary off-domain builds use the public proxy',
    input: { hostname: 'static.example.com', isViteDev: false, buildProxyMode: 'auto' },
    expected: 'public-proxy',
  },
  {
    name: 'lookalike domains are not treated as qpackages.com',
    input: { hostname: 'qpackages.com.example.com', isViteDev: false, buildProxyMode: 'auto' },
    expected: 'public-proxy',
  },
];

for (const testCase of cases) {
  assert.equal(selectApiTransport(testCase.input), testCase.expected, testCase.name);
}

console.log(`Transport selection: ${cases.length} cases passed.`);
