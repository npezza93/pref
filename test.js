/* global it, beforeEach, describe */

const path = require('path')
const fs = require('fs')
const {assert} = require('chai')
const tempy = require('tempy')
const Pref = require('.')

global.require = require

beforeEach(() => {
  this.pref = new Pref({cwd: tempy.directory()})
  this.fixture = '👾'
})

it('.get()', () => {
  assert.equal(this.pref.get('foo'), undefined)
  assert.equal(this.pref.get('foo', '🐴'), '🐴')
  this.pref.set('foo', this.fixture)
  assert.equal(this.pref.get('foo'), this.fixture)
})

describe('.set()', () => {
  it('standard', () => {
    this.pref.set('foo', this.fixture)
    this.pref.set('baz.boo', this.fixture)
    assert.equal(this.pref.get('foo'), this.fixture)
    assert.equal(this.pref.get('baz.boo'), this.fixture)
  })

  it('sets an object', () => {
    this.pref.set({
      foo1: 'bar1',
      foo2: 'bar2',
      baz: {
        boo: 'foo',
        foo: {
          bar: 'baz'
        }
      }
    })
    assert.equal(this.pref.get('foo1'), 'bar1')
    assert.equal(this.pref.get('foo2'), 'bar2')
    assert.deepEqual(this.pref.get('baz'), {boo: 'foo', foo: {bar: 'baz'}})
    assert.equal(this.pref.get('baz.boo'), 'foo')
    assert.deepEqual(this.pref.get('baz.foo'), {bar: 'baz'})
    assert.equal(this.pref.get('baz.foo.bar'), 'baz')
  })

  it('undefined', () => {
    assert.throws(
      () => this.pref.set('foo', undefined),
      'Use `delete()` to clear values'
    )
  })

  it('invalid key', () => {
    assert.throws(
      () => this.pref.set(1, 'unicorn'),
      'Expected `key` to be of type `string` or `object`, got number'
    )
  })
})

it('.has()', () => {
  this.pref.set('foo', this.fixture)
  this.pref.set('baz.boo', this.fixture)
  assert(this.pref.has('foo'))
  assert(this.pref.has('baz.boo'))
  assert.isNotOk(this.pref.has('missing'))
})

it('.delete()', () => {
  const {pref} = this
  pref.set('foo', 'bar')
  pref.set('baz.boo', true)
  pref.set('baz.foo.bar', 'baz')
  pref.delete('foo')
  assert.equal(pref.get('foo'), undefined)
  pref.delete('baz.boo')
  assert.notEqual(pref.get('baz.boo'), true)
  pref.delete('baz.foo')
  assert.notEqual(pref.get('baz.foo'), {bar: 'baz'})
  pref.set('foo.bar.baz', {awesome: 'icecream'})
  pref.set('foo.bar.zoo', {awesome: 'redpanda'})
  pref.delete('foo.bar.baz')
  assert.equal(pref.get('foo.bar.zoo.awesome'), 'redpanda')
})

it('.clear()', () => {
  this.pref.set('foo', 'bar')
  this.pref.set('foo1', 'bar1')
  this.pref.set('baz.boo', true)
  this.pref.clear()
  assert.equal(this.pref.size, 0)
})

it('.size', () => {
  this.pref.set('foo', 'bar')
  assert.equal(this.pref.size, 1)
})

it('.store', () => {
  this.pref.set('foo', 'bar')
  this.pref.set('baz.boo', true)
  assert.deepEqual(this.pref.store, {
    foo: 'bar',
    baz: {
      boo: true
    }
  })
})

it('`defaults` option', () => {
  const conf = new Pref({cwd: tempy.directory(), defaults: {foo: 'bar'}})

  assert.equal(conf.get('foo'), 'bar')
})

it('`configName` option', () => {
  const configName = 'alt-config'
  const conf = new Pref({cwd: tempy.directory(), configName})
  assert.equal(conf.get('foo'), undefined)
  conf.set('foo', this.fixture)
  assert.equal(conf.get('foo'), this.fixture)
  assert.equal(path.basename(conf.path, '.json'), configName)
})

it('`fileExtension` option', () => {
  const fileExtension = 'alt-ext'
  const conf = new Pref({
    cwd: tempy.directory(),
    fileExtension
  })
  assert.equal(conf.get('foo'), undefined)
  conf.set('foo', this.fixture)
  assert.equal(conf.get('foo'), this.fixture)
  assert.equal(path.extname(conf.path), `.${fileExtension}`)
})

it('is iterable', () => {
  this.pref.set({foo: this.fixture, bar: this.fixture})
  assert.deepEqual([...this.pref], [['foo', this.fixture], ['bar', this.fixture]])
})

it('doesn\'t write to disk upon instanciation if and only if the store didn\'t change', () => {
  let exists = fs.existsSync(this.pref.path)
  assert.isNotOk(exists)

  const pref = new Pref({cwd: tempy.directory(), defaults: {foo: 'bar'}})
  exists = fs.existsSync(pref.path)
  assert(exists)
})
