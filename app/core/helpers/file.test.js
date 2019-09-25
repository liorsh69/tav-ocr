const { expect } = require('chai')
const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')
const Jimp = require('jimp')
const { createFolder, copyFile, moveFile, convertPdf2Jpg } = require('./file')

const testsFolder = path.resolve(__dirname, '../', '../', 'tests')
const newTestFolder = path.resolve(testsFolder, 'createNewFolder')

// generate a random folder name
const randomName = `test-${Math.floor(Math.random() * 1000)}`
const randomFolder = path.resolve(newTestFolder, randomName)

const qrTestPdfFile = path.resolve(testsFolder, 'docs', 'qrTest.pdf')

const COPIED_FILE = 'copied.pdf'
const MOVED_FILE = 'moved.pdf'
const MOVED_FOLDER = 'moveFolder'
const PDF2JPG_FOLDER = 'pdf2jpg'

describe('createFolder', function() {
	it('should create new folder recursively', () => {
		return new Promise(async resolve => {
			// create the folder
			const folderCreated = await createFolder(randomFolder)
			expect(folderCreated).to.equal(true)

			// check if exists
			const folderCreatedCheck = fs.existsSync(randomFolder)
			expect(folderCreatedCheck).to.equal(true)

			resolve()
		})
	})
})

describe('copyFile', function() {
	it('should copy file', () => {
		return new Promise(async resolve => {
			const destinationFilePath = path.resolve(randomFolder, COPIED_FILE)

			const fileCopied = await copyFile(qrTestPdfFile, destinationFilePath)
			expect(fileCopied).to.equal(true)

			const fileCopiedCheck = fs.existsSync(destinationFilePath)
			expect(fileCopiedCheck).to.equal(true)

			resolve()
		})
	})
})

describe('moveFile', function() {
	it('should move file', () => {
		return new Promise(async resolve => {
			const fileToMove = path.resolve(randomFolder, COPIED_FILE)
			const destinationPath = path.resolve(randomFolder, MOVED_FOLDER, MOVED_FILE)

			const fileMoved = await moveFile(fileToMove, destinationPath)
			expect(fileMoved).to.equal(true)

			const fileMovedCheck = fs.existsSync(destinationPath)
			expect(fileMovedCheck).to.equal(true)

			resolve()
		})
	})
})

describe('convertPdf2Jpg', function() {
	// a bit longer then the usual timeout(2000ms)
	// normally should take about 3000ms
	this.timeout(5000)

	it('should convert PDF to JPG', () => {
		return new Promise(async resolve => {
			const jpgDestinationPath = path.resolve(randomFolder, PDF2JPG_FOLDER)

			// create new folder for this test
			const pdf2jpgFolderCreated = await createFolder(jpgDestinationPath)
			expect(pdf2jpgFolderCreated).to.equal(true)

			// convert PDF to JPG
			await convertPdf2Jpg(qrTestPdfFile, jpgDestinationPath)

			// check if file exists
			const pdfConvertedJpg = path.resolve(jpgDestinationPath, 'qrTest-1.jpg')
			const pdfConvertedJpgCheck = fs.existsSync(pdfConvertedJpg)
			expect(pdfConvertedJpgCheck).to.equal(true)

			// base file to compare with
			const basePdfJpgFile = path.resolve(testsFolder, 'docs', 'qrTest.jpg')

			const pdfConvertedJpgJimp = await Jimp.read(pdfConvertedJpg)
			const basePdfJpgFileJimp = await Jimp.read(basePdfJpgFile)

			// comapre the images
			const imagesDiff = await Jimp.diff(pdfConvertedJpgJimp, basePdfJpgFileJimp, 0)
			expect(imagesDiff.percent).to.equal(0)

			resolve()
		})
	})
})

describe('clean test', function() {
	it('should delete random test folder', () => {
		return new Promise(async resolve => {
			if (fs.existsSync(newTestFolder)) {
				fse.removeSync(newTestFolder)
			}

			const newTestFolderExists = fs.existsSync(newTestFolder)
			expect(newTestFolderExists).to.equal(false)

			resolve()
		})
	})
})
