/**tav-ocr
 * TAV Medical - I.T
 * https://tavmedical.com
 * https://github.com/liorsh69/tav-ocr
 * Feel free to use or modify with credit.
 */

const winston = require('winston') // log to file
const path = require('path') // built-in folders & file control
const fs = require('fs') // built-in file system control
const fse = require('fs-extra') // more file system control
const pdf = require('pdf-poppler') // pdf to jpg
const Jimp = require('jimp') // image control
const QrCode = require('qrcode-reader') // qr-code reader
const getImageData = require('get-image-data')
const jsQR = require('jsqr')
const chokidar = require('chokidar') // file system watcher - run ocr when new file is added
const shell = require('shelljs') // shell cmd
const nodemailer = require('nodemailer')
const moment = require('moment')
const Promise = require('bluebird')
const sql = require('mssql')

const sqlResultsArr = []

const DEV_MODE = !false

// log to file
const logger = initLogger()

/* SETTINGS */
const settings = readJson('./app/config/private/settings.json', './app/config/settings.json')
// action types
const types = readJson('./app/config/private/types.json', './app/config/types.json')
// qr coordinates on file
// https://www.image-map.net/
const coordinatesArr = readJson('./app/config/private/coordinates.json', './app/config/coordinates.json').array

// SMTP Client
const smtp = initSmtp()

// sql connection pool if needed
var poolPromise = false
if (settings.mssql && settings.mssql.server && settings.mssql.server != '') {
	poolPromise = new sql.ConnectionPool(settings.mssql)
		.connect()
		.then(pool => {
			logger.info('Connected to MSSQL')
			return pool
		})
		.catch(err => logger.error('Database Connection Failed! Bad Config: ', err))
}

logger.info('Initializing TAV-OCR')
const mainWatcher = watchFolder(settings.folderToWatch, handlePdfFile)

/** listen to new files in folder
 * @param {*} folderPath
 */
function watchFolder(folderPath, handleNewFile) {
	// Initialize watcher.
	logger.info(`Watching folder: ${folderPath}`)
	const watcher = chokidar.watch(folderPath, {
		// ignored: /^.((?!pdf|PDF).)*$/, // ignore all files that are not a PDF file
		ignored: /\.(?![pdf]|[PDF])[^.].*/, // ignore all files that are not a PDF file
		persistent: true, // always continue to watch
		depth: 0, // subdirectories traversed limit
		awaitWriteFinish: true, // wait for whole file to be
	})

	watcher.on('error', error => logger.error(`Watcher error: ${error}`)).on('add', handleNewFile)

	return watcher
}

function handlePdfFile(pdfFile) {
	logger.info(`File ${pdfFile} has been added`)

	const pdfFileExt = path.extname(pdfFile)
	const pdfFileName = path.basename(pdfFile, pdfFileExt)
	const pdfFileFolder = path.dirname(pdfFile)
	const tempImgFolder = path.join(pdfFileFolder, 'temp')
	var jpgFile = path.join(tempImgFolder, pdfFileName) + '-1.jpg'

	// check if file is PDF
	if (pdfFileExt.toLowerCase() !== '.pdf') {
		logger.info(`Not a PDF file: ${pdfFileExt}`)
		return
	}

	// create tempImgFolder folder if doesn't exists
	createFolder(tempImgFolder)

	logger.info('Converting PDF To Image')
	convertPdf2Jpg(pdfFile, tempImgFolder)
		.catch(logger.error)
		.then(async res => {
			// check temp jpgFile name
			if (!fs.existsSync(jpgFile)) {
				const tempJpgFile = jpgFile.replace('-1', '-01')
				if (fs.existsSync(tempJpgFile)) {
					jpgFile = tempJpgFile
				}
			}

			logger.info(`PDF Converted To Image: ${jpgFile}`)

			// go over all coordinates and try to get results
			const readQRresults = await Promise.map(coordinatesArr, (coordinates, coordinatesIdx) => {
				return readQR(jpgFile, coordinates, coordinatesIdx)
					.catch(error => {
						const jpgTestFileExt = path.extname(jpgFile)
						const jpgTestFileName = path.basename(jpgFile, jpgTestFileExt)
						logger.error(
							error
								? error
								: `QR not found in coordinates - ${jpgTestFileName}-test-${coordinatesIdx}: ${JSON.stringify(
										coordinates
								  )}`
						)
					})
					.then(result => {
						if (!result) {
							logger.info(`Empty QR result - ${coordinatesIdx}`)
							return false
						}

						logger.info(`QR result - ${coordinatesIdx}: ${result}`)

						try {
							const resultParseReady = result.replace(/\'/g, '"') // replace all ' with " to allow json.parse
							logger.info(`QR resultParseReady - ${coordinatesIdx}: ${resultParseReady}`)

							const jsonResult = JSON.parse(resultParseReady)
							return jsonResult
						} catch (error) {
							logger.error(`jsonResult parse Failed - ${coordinatesIdx}: ${error}`)
							return false
						}
					})
			})

			let funcDone = false
			Promise.all(readQRresults).then(readQRresults => {
				Promise.map(readQRresults, async jsonResult => {
					if (funcDone) {
						logger.info('Function Done Already')
						return false
					}

					if (!jsonResult) {
						logger.error(`${pdfFileName}: jsonResult Not Found`)
						return false
					}

					const action = types[jsonResult.type]

					if (!action) {
						logger.error(`${pdfFileName}-${action}: Action Not Found`)
						return false
					}

					if (!action.function) {
						logger.error(`${pdfFileName}-${action.function}: Action Function Not Configured`)
						return false
					}

					let actionFunction
					try {
						actionFunction = eval(action.function)
					} catch (error) {
						logger.error(`${pdfFileName}-${coordinatesIdx}-${action.function}: Action Function Not Found`)
						return false
					}

					if (funcDone) {
						logger.info('Function Done Already')
						return false
					}

					const actionFunctionResult = await actionFunction(pdfFile, jsonResult, action).catch(logger.error)

					if (funcDone) {
						logger.info('Function Done Already')
						return false
					}

					console.log('actionFunctionResult: ' + JSON.stringify(actionFunctionResult))

					if (!actionFunctionResult || !actionFunctionResult.result) {
						logger.warn('Unsuccessfully Action Function')
						return false
					}

					console.log(
						'SMTP: ' +
							JSON.stringify({
								from: settings.smtp.auth.user,
								to: action.smtp.email,
								subject: await resolveTemplate(jsonResult, action.smtp.subject),
								html: `<a href="${actionFunctionResult.smtp.link}">${actionFunctionResult.smtp.link}</a>`,
							})
					)

					if (action.smtp) {
						logger.info(`Sending Email:  ${action.smtp.email}`)
						smtp.sendMail({
							from: settings.smtp.auth.user,
							to: action.smtp.email,
							subject: await resolveTemplate(jsonResult, action.smtp.subject),
							html: `<a href="${actionFunctionResult.smtp.link}">${actionFunctionResult.smtp.link}</a>`,
						})

						logger.info(`Email Sent: ${action.smtp.email}`)
					}

					funcDone = true
					return
				})
			})
		})
}

async function move(pdfFile, jsonResult, action) {
	return new Promise(async (resolve, reject) => {
		// resolve file destination from QR JSON result
		const finalFileDestination = await resolveTemplate(jsonResult, action.path)
		const finalDestinationFolder = path.dirname(finalFileDestination)

		if (!finalDestinationFolder) {
			logger.error(`finalDestination error - ${coordinatesIdx}: ${finalDestinationFolder}`)
			resolve(false)
		}

		// create finalDestinationFolder folder if doesn't exists
		const folderCreated = await createFolder(finalDestinationFolder)
		const fileMoved = await moveFile(pdfFile, finalFileDestination)

		console.log('folderCreated: ' + folderCreated)
		console.log('fileMoved: ' + fileMoved)

		resolve({
			result: folderCreated && fileMoved,
			smtp: {
				link: finalFileDestination,
			},
		})
	})
}

/** convert image QR code to text
 * @param {*} jpgFile image path
 */
function readQR(jpgFile, coordinates, coordinatesIdx) {
	return Jimp.read(jpgFile)
		.catch(logger.error)
		.then(image => {
			return new Promise((resolve, reject) => {
				const jpgFileExt = path.extname(jpgFile)
				const jpgFileName = path.basename(jpgFile, jpgFileExt).replace('-1', '')
				const tempImgFolder = path.dirname(jpgFile)

				var qr = new QrCode()
				qr.callback = function(err, value) {
					if (err) {
						logger.error(`QR Error: ${err}`)
						reject(false)
					}

					// Remove Temp JPG File
					if (!DEV_MODE) {
						try {
							fs.unlinkSync(jpgFile)
						} catch (err) {
							logger.error(`Error Removing Temp Jpg File: ${err}`)
						}
					}

					const result = value.result
						.replace(/\&/g, "'")
						.replace(/\%/g, "'")
						.replace(/\+/g, "'")
						.replace(/\;/g, ':')
						.replace(/\=/g, '}')
						.replace(/\(/g, ',')

					if (result) {
						resolve(result)
					} else if (value.result) {
						resolve(value.result)
					} else {
						resolve(false)
					}
				}

				// crop image to get only the QR code
				// use this to get the coordinates
				// https://www.tutorialspoint.com/crop_image_online.htm
				const QRimage = image
					.quality(100)
					.crop(coordinates.x, coordinates.y, coordinates.squareSize, coordinates.squareSize)
					.quality(100)
					.resize(500, 500)

				// save temp images in dev mode
				if (DEV_MODE) {
					QRimage.write(path.join(tempImgFolder, jpgFileName + '-test-' + coordinatesIdx + '.jpg'))
				}

				// old qr reader
				// qr.decode(QRimage.bitmap)

				getImageData(QRimage, function(err, info) {
					if (err) {
						logger.error(`getImageData Error: ${err}`)
						resolve(false)
					}
					const { data, height, width } = info

					const code = jsQR(data, width, height)
					if (code) {
						logger.info(`jsQR Result: ${code.data}`)
						resolve(code.data)
					} else {
						logger.info(`jsQR Result Not Found: ${code}`)
						resolve(false)
					}
				})
			})
		})
}

/** convert pdf to jpg
 * @param {*} pdfFile
 * @param {*} outputFolder
 */
function convertPdf2Jpg(pdfFile, outputFolder) {
	const options = {
		format: 'jpeg',
		scale: 4096,
		out_dir: outputFolder,
		out_prefix: path.basename(pdfFile, path.extname(pdfFile)),
		page: 1,
	}

	return pdf.convert(pdfFile, options)
}

/** move file
 * @param {*} fileToMove
 * @param {*} destinationPath
 */
async function moveFile(fileToMove, destinationPath) {
	return new Promise(resolve => {
		logger.info('Moving File')
		logger.info(`From: ${fileToMove}`)
		logger.info(`To: ${destinationPath}`)

		const fileToMoveExt = path.extname(fileToMove)
		const fileToMoveName = path.basename(fileToMove, fileToMoveExt)

		try {
			fse.move(fileToMove, destinationPath, { overwrite: true }, err => {
				if (err) {
					logger.error(`moveFile rename Failed: ${err}`)
					resolve(false)
				} else {
					logger.info(`${fileToMoveName} - Successfully moved`)
					resolve(true)
				}
			})
		} catch (error) {
			logger.error(`moveFile Failed: ${error}`)
			resolve(false)
		}
	})
}

/** copy file
 * @param {*} fileToCopy
 * @param {*} destinationPath
 */
function copyFile(fileToCopy, destinationPath) {
	logger.info('Coping File')
	logger.info(`From: ${fileToCopy}`)
	logger.info(`To: ${destinationPath}`)

	try {
		fse.copy(fileToCopy, destinationPath, err => {
			if (err) {
				logger.error(`copyFile rename Failed: ${err}`)
				return
			} else {
				logger.info('Successfully copied')
			}
		})
	} catch (error) {
		logger.error(`copyFile Failed: ${error}`)
	}
}

/** replace json parameters in template
 * @param {*} jsonObject
 * @param {*} template
 */
async function resolveTemplate(jsonObject, template) {
	if (!jsonObject) {
		logger.error('resolveTemplate - Missing Parameter: jsonObject')
		return
	}
	if (!template) {
		logger.error('resolveTemplate - Missing Parameter: template')
		return
	}

	var tempTemplate = template

	logger.info(`resolveTemplate - Replacing Template: ${template}`)

	// loop over all json keys and replace in template
	for (var key in jsonObject) {
		const param = jsonObject[key]

		logger.info(`${key}: ${param}`)

		const objectKeysRegex = new RegExp(`\\$${key}\\$`, 'g')
		tempTemplate = tempTemplate.replace(objectKeysRegex, param)
	}

	// check if there are unresolved keys in template
	const keysRegex = new RegExp(`\\$.*\\$`, 'g')
	const templateUnresolved = tempTemplate.match(keysRegex)

	if (poolPromise && templateUnresolved) {
		logger.info(`templateUnresolved: ` + templateUnresolved)

		// try to get sql result if already exists
		let sqlResult = sqlResultsArr[jsonObject.lot]

		if (!sqlResult) {
			// get sql query result in json

			try {
				const pool = await poolPromise
				const sqlQuery = `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; SELECT VHWHLO AS "com", VHPRNO AS "pn", VHMFNO AS "mo", VHBANO AS "lot" FROM MVXJDTA.MWOHED WHERE VHBANO='${jsonObject.lot}'`
				logger.info('SQL Query: ' + sqlQuery)

				const sqlResultObj = await pool.request().query(sqlQuery)
				sqlResult = sqlResultObj.recordset[0]
				sqlResultsArr[jsonObject.lot] = sqlResult

				logger.info('SQL RESULT: ' + JSON.stringify(sqlResult))
			} catch (error) {
				logger.error(`SQL Query Error: ` + error)
			}
		}

		// loop over sql json result
		for (var key in sqlResult) {
			const param = sqlResult[key].replace(new RegExp(/[(\s)(\t)]/, 'g'), '')

			logger.info(`${key}: ${param}`)

			const objectKeysRegex = new RegExp(`\\$${key}\\$`, 'g')
			tempTemplate = tempTemplate.replace(objectKeysRegex, param)
		}
	}

	// replace today's date in template
	tempTemplate = tempTemplate.replace(new RegExp(`\\$today\\$`, 'g'), moment().format('DD-MM-YY'))
	tempTemplate = tempTemplate.replace('__dirname', __dirname)

	logger.info(`resolveTemplate - Template Resolved: ${tempTemplate}`)

	return tempTemplate
}

/** create folder recursively if not exists
 * @param {*} folderPath
 */
async function createFolder(folderPath) {
	return new Promise(resolve => {
		if (!fs.existsSync(folderPath)) {
			resolve(true)
		}

		logger.info(`Creating New Folder: ${folderPath}`)
		try {
			shell.mkdir('-p', folderPath)
			resolve(true)
		} catch (error) {
			logger.error(`cannot create folder: ${folderPath}`)
			resolve(false)
		}

		resolve(false)
	})
}

// log to file
function initLogger() {
	const jsonTimestampFormat = winston.format.printf(({ level, message, timestamp }) => {
		return `${timestamp} [${level}]: ${message}`
	})
	return winston.createLogger({
		format: winston.format.combine(
			winston.format.timestamp({ format: 'DD-MM-YYYY HH:mm:ss' }),
			jsonTimestampFormat
		),
		transports: [
			new winston.transports.Console(),
			new winston.transports.File({
				filename: 'console.log',
			}),
		],
	})
}

// SMTP Client
function initSmtp() {
	if (!settings.smtp || !settings.smtp.host) {
		logger.error('SMTP - Not Configured')
		return false
	}

	let transporter = nodemailer.createTransport(settings.smtp)

	// verify connection configuration
	transporter.verify(function(error, success) {
		if (error) {
			logger.error(error)
		} else {
			logger.info('SMTP Server is ready')
		}
	})

	return transporter
}

// read json file and convert into an object
function readJson(jsonFilePath, failoverFilePath) {
	if (!fs.existsSync(jsonFilePath)) {
		logger.info(`File Not Found: ${jsonFilePath}`)
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
	mainWatcher,
	readJson,
	resolveTemplate,
	createFolder,
	moveFile,
	copyFile,
	watchFolder,
	handlePdfFile,
}
