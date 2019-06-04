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
const chokidar = require('chokidar') // file system watcher - run ocr when new file is added
const shell = require('shelljs') // shell cmd
const nodemailer = require('nodemailer')
const moment = require('moment')

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
		.then(res => {
			// check temp jpgFile name
			if (!fs.existsSync(jpgFile)) {
				const tempJpgFile = jpgFile.replace('-1', '-01')
				if (fs.existsSync(tempJpgFile)) {
					jpgFile = tempJpgFile
				}
			}

			logger.info(`PDF Converted To Image: ${jpgFile}`)

			// go over all coordinates and try to get a result
			for (var coordinatesIdx in coordinatesArr) {
				const coordinates = coordinatesArr[coordinatesIdx]

				readQR(jpgFile, coordinates, coordinatesIdx)
					.catch(error => {
						logger.error(
							error
								? error
								: `QR not found in coordinates - ${coordinatesIdx}: ${JSON.stringify(coordinates)}`
						)
					})
					.then(result => {
						if (!result) {
							logger.info(`Empty QR result - ${coordinatesIdx}`)
							return
						}

						logger.info(`QR result - ${coordinatesIdx}: ${result}`)

						var jsonResult
						try {
							const resultParseReady = result.replace(/\'/g, '"') // replace all ' with " to allow json.parse
							logger.info(`QR resultParseReady - ${coordinatesIdx}: ${resultParseReady}`)

							jsonResult = JSON.parse(resultParseReady)
						} catch (error) {
							logger.error(`jsonResult parse Failed - ${coordinatesIdx}: ${error}`)
							return
						}

						const action = types[jsonResult.type]

						if (!action) {
							logger.error('Action Not Found')
							return false
						}

						if (!action.function) {
							logger.error('Action Function Not Configured')
							return false
						}

						let actionFunction
						try {
							actionFunction = eval(action.function)
						} catch (error) {
							logger.error('Action Function Not Found')
							return false
						}

						const actionFunctionResult = actionFunction(pdfFile, jsonResult, action)

						if (!actionFunctionResult) {
							logger.warn('Unsuccessfully Action Function')
						}

						if (action.smtp) {
							smtp.sendMail({
								from: settings.smtp.auth.user,
								to: action.smtp.email,
								subject: resolveTemplate(action.smtp.subject),
								html: `<a href="${finalFileDestination}">${finalFileDestination}</a>`,
							})
						}

						return true
					})
			}
		})
}
/** Move file to folder
 * @param {String} pdfFile - PDF file path
 * @param {Object} jsonResult - QR json result
 * @param {Object} action - action type json object
 */
function move(pdfFile, jsonResult, action) {
	// resolve file destination from QR JSON result
	const finalFileDestination = resolveTemplate(jsonResult, action.path)
	const finalDestinationFolder = path.dirname(finalFileDestination)

	if (!finalDestinationFolder) {
		logger.error(`finalDestination error - ${coordinatesIdx}: ${finalDestinationFolder}`)
		return false
	}

	// create finalDestinationFolder folder if doesn't exists
	const folderCreated = createFolder(finalDestinationFolder)

	const fileMoved = moveFile(pdfFile, finalFileDestination)

	return folderCreated && fileMoved
}

/** convert image QR code to text
 * @param {*} jpgFile image path
 */
function readQR(jpgFile, coordinates, coordinatesIdx) {
	return Jimp.read(jpgFile)
		.catch(logger.error)
		.then(image => {
			return new Promise((resolve, reject) => {
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

					resolve(value.result || false)
				}

				// crop image to get only the QR code
				// use this to get the coordinates
				// https://www.tutorialspoint.com/crop_image_online.htm
				const QRimage = image
					.quality(100)
					.crop(coordinates.x, coordinates.y, coordinates.squareSize, coordinates.squareSize)
					.quality(100)
					.resize(500, 500)

				// TEST - save as
				if (DEV_MODE) {
					const jpgFileExt = path.extname(jpgFile)
					const jpgFileName = path.basename(jpgFile, jpgFileExt).replace('-1', '')
					const tempImgFolder = path.dirname(jpgFile)

					QRimage.write(path.join(tempImgFolder, jpgFileName + '-test-' + coordinatesIdx + '.jpg'))
				}

				qr.decode(QRimage.bitmap)
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
function moveFile(fileToMove, destinationPath) {
	logger.info('Moving File')
	logger.info(`From: ${fileToMove}`)
	logger.info(`To: ${destinationPath}`)

	try {
		fse.move(fileToMove, destinationPath, err => {
			if (err) {
				logger.error(`moveFile rename Failed: ${err}`)
				return false
			} else {
				logger.info('Successfully moved')
				return true
			}
		})
	} catch (error) {
		logger.error(`moveFile Failed: ${error}`)
		return false
	}

	return false
}

/** copy file
 * @param {*} fileToCopy
 * @param {*} destinationPath
 */
function copyFile(fileToCopy, destinationPath) {
	logger.info(`Coping File - From: ${fileToCopy} To: ${destinationPath}`)

	try {
		fse.copy(fileToCopy, destinationPath, err => {
			if (err) {
				logger.error(`copyFile rename Failed: ${err}`)
				return false
			} else {
				logger.info('Successfully copied')
				return true
			}
		})
	} catch (error) {
		logger.error(`copyFile Failed: ${error}`)
		return false
	}
	return false
}

/** replace json parameters in template
 * @param {*} jsonObject
 * @param {*} template
 */
function resolveTemplate(jsonObject, template) {
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

		const regex = new RegExp(`\\$${key}\\$`, 'g')
		tempTemplate = tempTemplate.replace(regex, param)
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
function createFolder(folderPath) {
	if (!fs.existsSync(folderPath)) {
		logger.info(`Creating New Folder: ${folderPath}`)
		try {
			shell.mkdir('-p', folderPath)
			return true
		} catch (error) {
			logger.error(`cannot create folder: ${folderPath}`)
			return false
		}
	}
	return false
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
