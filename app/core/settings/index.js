const fs = require('fs')
const path = require('path')
const nconf = require('nconf')

class Config {
	constructor() {
		const configFolders = {
			default: path.resolve(__dirname, '../../config'),
			private: path.resolve(__dirname, '../../config/private'),
		}

		//check for config folders
		const privateFolderExists = fs.existsSync(configFolders.private)
		const CONFIG_PATH = privateFolderExists ? configFolders.private : configFolders.default

		nconf.file('settings', path.resolve(CONFIG_PATH, 'settings.json'))
		nconf.file('coordinates', path.resolve(CONFIG_PATH, 'coordinates.json'))
		nconf.file('types', path.resolve(CONFIG_PATH, 'types.json'))
		nconf.load()
	}
}

Config.prototype.get = function(key) {
	return nconf.get(key)
}

module.exports = new Config()
