/** template.js
 *  Handle strings templates
 */

const moment = require('moment')
const path = require('path')
const { logger } = require('./logger')
const { execQuery } = require('./mssql')

const keysRegex = new RegExp(`\\$.*\\$`, 'g')

/** replace json parameters in template
 * @param {*} jsonObject
 * @param {*} template
 */
async function resolveTemplate(jsonObject, template) {
	return new Promise(async resolve => {
		if (!jsonObject) {
			logger.error('resolveTemplate - Missing Parameter: jsonObject')
			resolve(false)
			return
		}
		if (!template) {
			logger.error('resolveTemplate - Missing Parameter: template')
			resolve(false)
			return
		}

		var tempTemplate = template

		logger.info(`resolveTemplate - Replacing Template: ${template}`)

		// replace today's date in template
		tempTemplate = tempTemplate.replace(new RegExp(`\\$today\\$`, 'g'), moment().format('DD-MM-YY'))
		tempTemplate = tempTemplate.replace('__dirname', __dirname)

		// loop over all json keys and replace in template
		for (var key in jsonObject) {
			const param = jsonObject[key]

			logger.info(`${key}: ${param}`)

			const objectKeysRegex = new RegExp(`\\$${key}\\$`, 'g')
			tempTemplate = tempTemplate.replace(objectKeysRegex, param)
		}

		// check if there are unresolved keys in template
		var templateUnresolved = tempTemplate.match(keysRegex)

		if (templateUnresolved) {
			logger.info(`SQL templateUnresolved: ` + templateUnresolved)

			// get sql query result in json
			// TODO: move to settings
			const sqlQuery = `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; SELECT VHWHLO AS "com", VHPRNO AS "pn", VHMFNO AS "mo", VHBANO AS "lot" FROM MVXJDTA.MWOHED WHERE VHBANO='${jsonObject.lot}'`
			sqlResult = await execQuery(sqlQuery, jsonObject.lot)

			if (sqlResult) {
				// loop over sql json result
				for (var key in sqlResult) {
					const param = sqlResult[key].replace(new RegExp(/[(\s)(\t)]/, 'g'), '')

					logger.info(`${key}: ${param}`)

					const objectKeysRegex = new RegExp(`\\$${key}\\$`, 'g')
					tempTemplate = tempTemplate.replace(objectKeysRegex, param)
				}
			}
		}

		// check if there are unresolved keys in template
		templateUnresolved = tempTemplate.match(keysRegex)

		if (templateUnresolved) {
			logger.error('resolveTemplate - Error Resolving Template: ' + tempTemplate)
			resolve(tempTemplate)
			return
		}

		logger.info(`resolveTemplate - Template Resolved: ${tempTemplate}`)

		resolve(path.resolve(tempTemplate))
		return
	})
}

module.exports = { resolveTemplate }
