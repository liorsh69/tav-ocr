const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')
const { expect } = require('chai')
const { watchFolder } = require('./watch')
const { copyFile } = require('./file')

const testsFolder = path.resolve(__dirname, '../', '../', 'tests')
const qrTestPdfFile = path.resolve(testsFolder, 'docs', 'qrTest.pdf')
const folderToWatch = path.resolve(testsFolder, 'watch')

const COPIED_FILE_NAME = 'copiedFile'

const TEST_PDF_FILE = {
	path: path.resolve(folderToWatch, `${COPIED_FILE_NAME}.pdf`),
	name: COPIED_FILE_NAME,
	ext: '.pdf',
}

describe('watchFolder', function() {
	// long timeout to allow the watchFolder function to start
	this.timeout(15000)

	let testWatcher

	it('should copy a file to the watched folder', () => {
		return new Promise(async resolve => {
			const fileFinalPath = path.resolve(folderToWatch, `${COPIED_FILE_NAME}.pdf`)
			const fileCopied = await copyFile(qrTestPdfFile, fileFinalPath).catch(console.error)

			expect(fileCopied).to.equal(true)
			resolve()
		})
	})

	it('should watch folder for new files', () => {
		return new Promise(async resolve => {
			testWatcher = watchFolder(folderToWatch, pdfFile => {
				const pdfFileExt = path.extname(pdfFile)
				const pdfFileName = path.basename(pdfFile, pdfFileExt)

				const pdfFileObj = {
					path: pdfFile,
					name: pdfFileName,
					ext: pdfFileExt,
				}

				console.log(JSON.stringify(pdfFileObj))

				expect(pdfFileObj.path).to.equal(TEST_PDF_FILE.path)
				expect(pdfFileObj.name).to.equal(TEST_PDF_FILE.name)
				expect(pdfFileObj.ext).to.equal(TEST_PDF_FILE.ext)

				resolve(pdfFileObj)
			})
		})
	})

	it('should stop test watcher & clean up', () => {
		return new Promise(async resolve => {
			testWatcher.close()

			if (fs.existsSync(folderToWatch)) {
				fse.removeSync(folderToWatch).catch(console.error)
			}

			const folderToWatchExists = fs.existsSync(folderToWatch)
			expect(folderToWatchExists).to.equal(false)
			resolve()
		})
	})
})
