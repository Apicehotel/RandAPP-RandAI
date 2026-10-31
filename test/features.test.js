import test from 'node:test'
import assert from 'node:assert/strict'
import { createFeatures } from '../src/app/features.js'

test('RandAI è spento per default', () => {
  assert.equal(createFeatures({}).randai, false)
  assert.equal(createFeatures({ VITE_FEATURE_RANDAI: '' }).randai, false)
  assert.equal(createFeatures({ VITE_FEATURE_RANDAI: 'false' }).randai, false)
  assert.equal(createFeatures({ VITE_FEATURE_RANDAI: '1' }).randai, false)
})

test('RandAI si accende solo con "true"', () => {
  assert.equal(createFeatures({ VITE_FEATURE_RANDAI: 'true' }).randai, true)
  assert.equal(createFeatures({ VITE_FEATURE_RANDAI: 'TRUE' }).randai, true)
})
