/** readJson.js
 *  read json file and convert into an object
 * 	!!!!Deprecated!!!! - using nconf to read json config files
 */

const fs = require('fs')
const { logger } = require('./logger')

function readJson(jsonFilePath, failoverFilePath) {
	if (!fs.existsSync(jsonFilePath)) {
		logger.error(`File Not Found: ${jsonFilePath}`)
		return failoverFilePath ? readJson(failoverFilePath) : false
	}

	try {
		const rawJsonData = fs.readFileSync(jsonFilePath)
		const jsonObj = JSON.parse(rawJsonData)
		return jsonObj
	} catch (error) {
		logger.error('Failed to read JSON object')
		return
	}
}

module.exports = {
	readJson,
}
