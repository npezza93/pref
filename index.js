'use strict'
const fs = require('fs')
const path = require('path')
const electron = require('electron')
const {isDeepStrictEqual} = require('util')
const crypto = require('crypto')
const dotProp = require('dot-prop')
const makeDir = require('make-dir')
const writeFileAtomic = require('write-file-atomic')
const semver = require('semver')
const {Emitter} = require('event-kit')
const Ajv = require('ajv')

const {initOptions, colorCoercer} = require('./utils')

module.exports =
class Pref {
  constructor(options) {
    options = initOptions(options)

    this.events = new Emitter()
    this.path = path.resolve(options.cwd, `${options.configName}.${options.fileExtension}`)

    if (options.schema) {
      this.ajv = new Ajv({coerceTypes: true, useDefaults: true})
      this.ajv.addKeyword('color', {compile: _ => colorCoercer})
      this.schema = options.schema
    }

    const fileStore = this.store
    const store = {...options.defaults, ...fileStore}

    if (!isDeepStrictEqual(fileStore, store)) {
      this.store = store
    }

    this.migrate(options)
    this.watch(options)
  }

  get(key, defaultValue) {
    const data = {...this.store}

    if (this.schema && this.ajv) {
      const validate = this.ajv.compile(this.schema)

      validate(data)
    }

    return dotProp.get(data, key, defaultValue)
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

    this.store = store
  }

  has(key) {
    return dotProp.has(this.store, key)
  }

  delete(key) {
    const {store} = this
    dotProp.delete(store, key)
    this.store = store
  }

  clear() {
    this.store = {}
  }

  dispose() {
    this.events.dispose()
    if (this.fileWatcher) {
      this.fileWatcher.close()
    }
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

    return this.events.on('change', onChange)
  }

  get size() {
    return Object.keys(this.store).length
  }

  get store() {
    try {
      const data = this.readPreferences()

      return {...JSON.parse(data)}
    } catch (error) {
      if (error.name === 'SyntaxError') {
        return {}
      }

      throw error
    }
  }

  set store(value) {
    this.createDir()

    const data = JSON.stringify(value, null, '\t')

    this.currentHash = crypto.createHash('md5').update(data).digest('hex')

    writeFileAtomic.sync(this.path, data)
    this.events.emit('change')
  }

  openInEditor() {
    electron.shell.openItem(this.path)
  }

  createDir() {
    // Ensure the directory exists as it could have been deleted in the meantime
    makeDir.sync(path.dirname(this.path))
  }

  readPreferences() {
    try {
      return fs.readFileSync(this.path, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.createDir()
        return JSON.stringify({}, null, '\t')
      }

      throw error
    }
  }

  watch(options) {
    if (options.watch || options.watch === undefined) {
      this.createDir()

      let wait = false
      this.fileWatcher = fs.watch(path.dirname(this.path), {encoding: 'utf8'}, () => {
        if (!wait) {
          wait = setTimeout(() => {
            wait = false
          }, 100)

          const newHash = crypto.createHash('md5').update(this.readPreferences())
          if (!isDeepStrictEqual(this.currentHash, newHash.digest('hex'))) {
            this.events.emit('change')
          }
        }
      })
    }
  }

  migrate(options) {
    if (options.migrations) {
      const runningVersion = this.store.version || '0.0.0'

      if (semver.lt(runningVersion, options.packageVersion)) {
        const migrationsToRun = Object.keys(options.migrations).filter(version => {
          return semver.lte(version, options.packageVersion) && semver.gt(version, runningVersion)
        }).sort(semver.compare)

        for (const version of migrationsToRun) {
          options.migrations[version](this)
        }
      }

      if (runningVersion !== options.packageVersion) {
        this.set('version', options.packageVersion)
      }
    }
  }

  isValid() {
    const data = {...this.store}
    const validate = this.ajv.compile(this.schema)

    return validate(data)
  }

  * [Symbol.iterator]() {
    const {store} = this

    for (const entry of Object.entries(store)) {
      yield entry
    }
  }
}
