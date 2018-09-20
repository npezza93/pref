# pref [![Build Status: Linux and macOS](https://travis-ci.org/npezza93/pref.svg?branch=master)](https://travis-ci.org/npezza93/pref)

> Simple preference handling for your electron application

This is heavily inspired by [@sindresorhus](https://github.com/sindresorhus)'s [conf](https://github.com/sindresorhus/conf) and [electron-store](https://github.com/sindresorhus/electron-store) projects. Shout out to him for creating these spectacular packages.

## Install

```bash
❯ yarn add pref
```

## Usage

```js
const Pref = require('pref');
const preferences = new Pref();

preferences.set('spaceInvader', '👾');
console.log(preferences.get('spaceInvader'));
//=> '👾'

// Use dot-notation to access nested properties
preferences.set('foo.bar', true);
console.log(preferences.get('foo'));
//=> {bar: true}

preferences.delete('spaceInvader');
console.log(preferences.get('spaceInvader'));
//=> undefined
```

## API

Changes are written to disk atomically, so if the process crashes during a write, it will not corrupt the existing config.

### Pref([options])

Returns a new instance.

### options

#### defaults

Type: `Object`

Default config.

#### configName

Type: `string`<br>
Default: `config`

Name of the config file (without extension).

Useful if you need multiple config files for your app or module. For example,
different config files between two major versions.

#### projectName

Type: `string`<br>
Default: The `name` field in the package.json closest to where `pref` is imported.

You only need to specify this if you don't have a package.json file in your
project.

#### cwd

Type: `string`<br>
Default: System default [user config directory](https://github.com/sindresorhus/env-paths#pathsconfig)

**You most likely don't need this. Please don't use it unless you really have to.**

Overrides `projectName`.

The only use-case I can think of is having the config located in the app
directory or on some external storage.

#### fileExtension

type: `string`<br>
Default: `json`

Extension of the config file.

You would usually not need this, but could be useful if you want to interact
with a file with a custom file extension that can be associated with your app.
These might be simple save/export/preference files that are intended to be
shareable or saved outside of the app.

### Instance

You can use [dot-notation](https://github.com/sindresorhus/dot-prop) in a `key` to access nested properties.

The instance is [`iterable`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Iteration_protocols) so you can use it directly in a [`for…of`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Statements/for...of) loop.

#### .set(key, value)

Set an item.

The `value` must be JSON serializable.

#### .set(object)

Set multiple items at once.

#### .get(key, [defaultValue])

Get an item or `defaultValue` if the item does not exist.

#### .has(key)

Check if an item exists.

#### .delete(key)

Delete an item.

#### .clear()

Delete all items.

#### .onDidChange(key, callback)

`callback`: `(newValue, oldValue) => {}`

Watches the given `key`, calling `callback` on any changes. When a key is first
set `oldValue` will be `undefined`, and when a key is deleted `newValue` will be
`undefined`.

#### .size

Get the item count.

#### .store

Get all the config as an object or replace the current config with an object:

```js
pref.store = {
	hello: 'world'
};
```

#### .path

Get the path to the config file.


#### watch

type: `boolean`<br>
Default: `true`

Sets a file watcher.

This is useful if you have more than one window reading the preferences. If one
window changes a preference, this allows it to get propagated to all instances
of Pref. If only ever have one instance on Pref in your app you can turn this
off.


## License

MIT © [Nick Pezza](https://pezza.co)
