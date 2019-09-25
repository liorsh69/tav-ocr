/** file.js
 *  Handle folders & files
 */

const fs = require('fs')
const fse = require('fs-extra')
const path = require('path')
const shell = require('shelljs')
const pdf = require('pdf-poppler')
const { logger } = require('./logger')

/** move file
 * @param {*} fileToMove
 * @param {*} destinationPath
 */
async function moveFile(fileToMove, destinationPath) {
	return new Promise(resolve => {
		fileToMove = path.resolve(fileToMove)
		destinationPath = path.resolve(destinationPath)

		if (!fs.existsSync(fileToMove)) {
			logger.error("fileToMove - File Does'nt exists: " + fileToMove)
			resolve(false)
			return
		}

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
function copyFile(fileToCopy, destinationFilePath) {
	return new Promise(resolve => {
		logger.info('Coping File')
		logger.info(`From: ${fileToCopy}`)
		logger.info(`To: ${destinationFilePath}`)

		try {
			fse.copy(fileToCopy, destinationFilePath, err => {
				if (err) {
					logger.error(`copyFile Failed: ${err}`)
					resolve(false)
				} else {
					logger.info('Successfully copied')
					resolve(true)
				}
			})
		} catch (error) {
			logger.error(`copyFile Failed: ${error}`)
			resolve(false)
		}
	})
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

module.exports = { moveFile, copyFile, createFolder, convertPdf2Jpg }
