'use strict'
const fs = require('fs')
const path = require('path')
const electron = require('electron')
const {isDeepStrictEqual} = require('util')
const crypto = require('crypto')
const dotProp = require('dot-prop')
const makeDir = require('make-dir')
const pkgUp = require('pkg-up')
const envPaths = require('env-paths')
const writeFileAtomic = require('write-file-atomic')
const compareVersions = require('compare-versions')
const {Emitter} = require('event-kit')

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

    options = {
      configName: 'config',
      fileExtension: 'json',
      cwd: this.findCwd(options),
      ...options
    }

    this.events = new Emitter()
    this.path = path.resolve(options.cwd, `${options.configName}.${options.fileExtension}`)

    const fileStore = this.store
    const store = {...options.defaults, ...fileStore}

    if (!isDeepStrictEqual(fileStore, store)) {
      this.store = store
    }

    this.migrate(options, pkg)
    this.watch(options)
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
      fs.watch(path.dirname(this.path), {encoding: 'utf8'}, () => {
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

  findCwd(options) {
    const defaultElectronCwd = app && app.getPath('userData')
    let cwd

    if (options.cwd && !path.isAbsolute(options.cwd) && defaultElectronCwd) {
      cwd = path.join(defaultElectronCwd, options.cwd)
    } else if (!options.cwd && defaultElectronCwd) {
      cwd = defaultElectronCwd
    } else if (!options.cwd) {
      cwd = envPaths(options.projectName).config
    }

    return cwd
  }

  openInEditor() {
    electron.shell.openItem(this.path)
  }

  migrate(options, pkg) {
    if (options.migrations) {
      const runningVersion = this.get('version')

      if (runningVersion && compareVersions(runningVersion, pkg.version) === -1) {
        const migrationsToRun = Object.keys(options.migrations).filter(version => {
          return compareVersions(version, pkg.version) === -1 &&
            compareVersions(version, runningVersion) === 1
        }).sort(compareVersions)

        for (const version of migrationsToRun) {
          options.migrations[version](this)
        }
      }

      if (runningVersion !== pkg.version) {
        this.set('version', pkg.version)
      }
    }
  }

  * [Symbol.iterator]() {
    const {store} = this

    for (const entry of Object.entries(store)) {
      yield entry
    }
  }
}
