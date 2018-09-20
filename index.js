'use strict'
const fs = require('fs')
const path = require('path')
const EventEmitter = require('events')
const electron = require('electron')
const isDeepStrictEqual = require('util')
const dotProp = require('dot-prop')
const makeDir = require('make-dir')
const pkgUp = require('pkg-up')
const envPaths = require('env-paths')
const writeFileAtomic = require('write-file-atomic')

const plainObject = () => Object.create(null)

// Prevent caching of this module so module.parent is always accurate
delete require.cache[__filename]
const parentDir = path.dirname((module.parent && module.parent.filename) || '.')

module.exports =
class Pref {
  constructor(options) {
    const pkgPath = pkgUp.sync(parentDir)

    options = {
      projectName: pkgPath && global['require'](pkgPath).name, // eslint-disable-line dot-notation
      ...options
    }

    if (!options.projectName && !options.cwd) {
      throw new Error('Project name could not be inferred. Please specify the `projectName` option.')
    }

    options = {configName: 'config', fileExtension: 'json', ...options}

    if (!options.cwd) {
      options.cwd = envPaths(options.projectName).config
    }

    this.events = new EventEmitter()
    this.path = path.resolve(options.cwd, `${options.configName}.${options.fileExtension}`)

    const fileStore = this.store
    const store = {...options.defaults, ...fileStore}

    if (!isDeepStrictEqual(fileStore, store)) {
      this.store = store
      this.cachedStore = store
    }
    this.watch()
  }

  get(key, defaultValue) {
    return dotProp.get(this.store, key, defaultValue)
  }

  set(key, value) {
    if (typeof key !== 'string' && typeof key !== 'object') {
      throw new TypeError(`Expected \`key\` to be of type \`string\` or \`object\`, got ${typeof key}`)
    }

    if (typeof key !== 'object' && value === undefined) {
      throw new TypeError('Use `delete()` to clear values')
    }

    const {store} = this

    if (typeof key === 'object') {
      for (const k of Object.keys(key)) {
        dotProp.set(store, k, key[k])
      }
    } else {
      dotProp.set(store, key, value)
    }

    this.cachedStore = store
    this.store = store
  }

  has(key) {
    return dotProp.has(this.store, key)
  }

  delete(key) {
    const {store} = this
    dotProp.delete(store, key)
    this.cachedStore = store
    this.store = store
  }

  clear() {
    this.cachedStore = {}
    this.store = {}
  }

  onDidChange(key, callback) {
    if (typeof key !== 'string') {
      throw new TypeError(`Expected \`key\` to be of type \`string\`, got ${typeof key}`)
    }

    if (typeof callback !== 'function') {
      throw new TypeError(`Expected \`callback\` to be of type \`function\`, got ${typeof callback}`)
    }

    let currentValue = this.get(key)

    const onChange = () => {
      const oldValue = currentValue
      const newValue = this.get(key)

      if (!isDeepStrictEqual(newValue, oldValue)) {
        currentValue = newValue
        callback.call(this, newValue, oldValue)
      }
    }

    this.events.on('change', onChange)

    return this.disposable(onChange)
  }

  get size() {
    return Object.keys(this.store).length
  }

  get store() {
    try {
      const data = fs.readFileSync(this.path, 'utf8')

      return {...JSON.parse(data)}
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.createDir()
        return plainObject()
      }

      if (error.name === 'SyntaxError') {
        return plainObject()
      }

      throw error
    }
  }

  set store(value) {
    this.createDir()

    writeFileAtomic.sync(this.path, JSON.stringify(value, null, '\t'))
    this.events.emit('change')
  }

  createDir() {
    // Ensure the directory exists as it could have been deleted in the meantime
    makeDir.sync(path.dirname(this.path))
  }

  watch() {
    this.createDir()

    let wait = false
    fs.watch(path.dirname(this.path), {encoding: 'utf8'}, () => {
      if (!wait) {
        wait = setTimeout(() => {
          wait = false
        }, 100)
        if (!isDeepStrictEqual(this.cachedStore, this.store)) {
          this.events.emit('change')
        }
      }
    })
  }

  disposable(onChange) {
    return {
      dispose() {
        return this.events.removeListener('change', onChange)
      }
    }
  }

  openInEditor() {
    electron.shell.openItem(this.path)
  }

  * [Symbol.iterator]() {
    const {store} = this

    for (const entry of Object.entries(store)) {
      yield entry
    }
  }
}