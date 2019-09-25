/** mssql.js
 *  Initialize MS-SQL connection to server
 */

const sql = require('mssql')
const { logger } = require('./logger')

// store main pool promise
var poolPromise = false

// store old queries for this run only to avoid massive queries on server
const sqlResultsArr = []

function initSql(config) {
	if (!config || !config.server || config.server == '') {
		logger.warn('MSSQL - Not Configured')
		return false
	}

	poolPromise = new sql.ConnectionPool(config)
		.connect()
		.then(pool => {
			logger.info('Connected to MSSQL')
			return pool
		})
		.catch(err => logger.error('Database Connection Failed! Bad Config: ', err))

	return poolPromise
}

async function execQuery(sqlQuery, identifier) {
	return new Promise(async resolve => {
		const pool = await poolPromise

		if (!pool) {
			logger.info('SQL Not Configured')
			resolve(false)
			return false
		}

		// try to get sql result if already exists
		let sqlResult = sqlResultsArr[identifier]

		if (!sqlResult) {
			try {
				logger.info('SQL Query: ' + sqlQuery)

				const sqlResultObj = await pool.request().query(sqlQuery)
				sqlResult = sqlResultObj.recordset[0]
				if (!sqlResultsArr[identifier]) {
					sqlResultsArr[identifier] = sqlResult
					logger.info(`${identifier}: ${JSON.stringify(sqlResultsArr[identifier])}`)
				}
			} catch (error) {
				logger.error(`SQL Query Error: ` + error)
				resolve(false)
			}

			logger.info('SQL RESULT: ' + JSON.stringify(sqlResult))
			resolve(sqlResult)
		}
	})
}

module.exports = { initSql, execQuery }
