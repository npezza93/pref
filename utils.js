'use strict'

const path = require('path')
const electron = require('electron')
const pkgUp = require('pkg-up')
const envPaths = require('env-paths')
const color = require('color')

// Prevent caching of this module so module.parent is always accurate
delete require.cache[__filename]
const parentDir = path.dirname((module.parent && module.parent.filename) || '.')
const pkgPath = pkgUp.sync(parentDir)

const pkg = (pkgPath && require(pkgPath)) || {} // eslint-disable-line dot-notation

const electronApp = () => {
  return (electron && electron.app) || require('@electron/remote').app
}

const findCwd = options => {
  const app = electronApp()

  const defaultCwd = app && app.getPath('userData')

  let cwd

  if (options.cwd && path.isAbsolute(options.cwd)) {
    cwd = options.cwd
  } else if (options.cwd && !path.isAbsolute(options.cwd) && defaultCwd) {
    cwd = path.join(defaultCwd, options.cwd)
  } else if (defaultCwd) {
    cwd = defaultCwd
  } else {
    cwd = envPaths(options.projectName).config
  }

  return cwd
}

const initOptions = options => {
  options = {projectName: pkg.name, ...options}

  if (!options.projectName && !options.cwd) {
    throw new Error('Project name could not be inferred. Please specify the `projectName` option.')
  }

  options = {
    configName: 'config',
    fileExtension: 'json',
    cwd: findCwd(options),
    packageVersion: (electronApp() && electronApp().getVersion()) || pkg.version,
    ...options
  }

  return options
}

const colorCoercer = (data, dataPath, parentData, parentDataProperty) => {
  try {
    parentData[parentDataProperty] = color(data).toString()
    return true
  } catch (_) {
    return false
  }
}

module.exports = {pkg, initOptions, colorCoercer}
