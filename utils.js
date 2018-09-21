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

const findCwd = options => {
  const app = electron && (electron || electron.remote)
  const defaultElectronCwd = app && app.app && app.app.getPath('userData')

  let cwd

  if (options.cwd && !path.isAbsolute(options.cwd) && defaultElectronCwd) {
    cwd = path.join(defaultElectronCwd, options.cwd)
  } else if (!options.cwd && defaultElectronCwd) {
    cwd = defaultElectronCwd
  }

  return cwd || envPaths(options.projectName).config
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
