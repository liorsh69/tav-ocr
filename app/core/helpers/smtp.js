/** smtp.js
 *  Initialize SMTP client
 */

const nodemailer = require('nodemailer')
const { logger } = require('./logger')

function initSmtp(config) {
	// check if configured
	if (!config || !config.host) {
		logger.warn('SMTP - Not Configured')
		return false
	}

	let transporter = nodemailer.createTransport(config)

	// verify connection configuration
	transporter.verify(function(error) {
		if (error) {
			logger.error('SMTP Error: ' + error)
		} else {
			logger.info('SMTP Server is ready')
		}
	})

	return transporter
}

module.exports = {
	initSmtp,
}
