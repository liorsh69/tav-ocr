/**tav-ocr
 * TAV Medical - I.T
 * https://tavmedical.com
 * https://github.com/liorsh69/tav-ocr
 * Feel free to use or modify with credit.
 */

const path = require('path')
const fs = require('fs')
const Promise = require('bluebird')
const config = require('./app/core/settings')

// Import core app helpers
const {
	logger,
	initSmtp,
	initSql,
	resolveTemplate,
	createFolder,
	watchFolder,
	convertPdf2Jpg,
	readQR,
} = require('./app/core/helpers')

// Import action functions - ignore unused functions
const { move } = require('./app/core/action')

const settings = config.get('settings')
const types = config.get('types')
const coordinatesArr = config.get('coordinates')

// SMTP Client
const smtp = initSmtp(settings.smtp)

// sql connection pool if needed
initSql(settings.mssql)

logger.info('<----- Initializing TAV-OCR ----->')
const mainWatcher = watchFolder(settings.folderToWatch, handlePdfFile)

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

	logger.info(`${pdfFileName} - Converting PDF To Image`)
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
								? 'readQR - Unknown Error: ' + error
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
						logger.error(`${pdfFileName}-${action.function}: Action Function Not Found`)
						return false
					}

					if (funcDone) {
						logger.info('Function Done Already')
						return false
					}

					const actionFunctionResult = await actionFunction(pdfFile, jsonResult, action).catch(logger.error)
					logger.info('actionFunctionResult: ' + JSON.stringify(actionFunctionResult))

					if (funcDone) {
						logger.info('Function Done Already')
						return false
					}

					if (!actionFunctionResult || !actionFunctionResult.result) {
						logger.warn('Unsuccessfully Action Function')
						return false
					}

					if (action.smtp) {
						logger.info(`Sending Email:  ${action.smtp.email}`)

						const subject = await resolveTemplate(jsonResult, action.smtp.subject)
						if (!subject) {
							logger.warn('SMTP subject - Failed to resolve Template: ' + subject)
							return false
						}

						smtp.sendMail(
							{
								from: settings.smtp.auth.user,
								to: action.smtp.email,
								subject,
								html: `<a href="${actionFunctionResult.smtp.link}">${actionFunctionResult.smtp.link}</a>`,
							},
							err => {
								if (err) {
									logger.error('sendMail Error: ' + err)
								}
							}
						)

						logger.info(`Email Sent: ${action.smtp.email}`)
					}

					funcDone = true
					return
				})
			})
		})
}

module.exports = {
	mainWatcher,
	handlePdfFile,
}
