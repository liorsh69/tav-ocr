/** logger.js
 *  Initialize logger to allow easy debuging in service run time
 */

// destructuring 'winston' logger library
const { format, createLogger, transports } = require('winston')
const { printf, combine, colorize, timestamp, align } = format

// import 'winston-daily-rotate-file' plugin directly to allow prototype injection directly to winston
require('winston-daily-rotate-file')

const DEFAULT_SETTINGS = {
	datePattern: 'YYYY-MM-DD',
	maxSize: '20m',
	maxFiles: '14d',
	zippedArchive: false,
	extension: '.log',
	dirname: 'logs',
}

function initLogger() {
	// constract the logs lines text format
	const jsonTimestampFormat = printf(({ level, message, timestamp }) => {
		return `${timestamp} [${level}]: ${message}`
	})

	return createLogger({
		exitOnError: false,
		// default format
		format: combine(align(), timestamp({ format: 'DD-MM-YYYY HH:mm:ss' }), jsonTimestampFormat),
		transports: [
			new transports.Console({
				// console specific format with colors
				format: combine(colorize(), align(), timestamp({ format: 'DD-MM-YYYY HH:mm:ss' }), jsonTimestampFormat),
			}),
			new transports.DailyRotateFile({
				...DEFAULT_SETTINGS,
				filename: 'console-%DATE%',
			}),
		],
		exceptionHandlers: [
			new transports.DailyRotateFile({
				...DEFAULT_SETTINGS,
				filename: 'exception-%DATE%',
			}),
		],
	})
}

const logger = initLogger()

module.exports = { logger }
