const { expect } = require('chai')
const fs = require('fs')
const path = require('path')
const fse = require('fs-extra')

const {
	mainWatcher,
	readJson,
	resolveTemplate,
	createFolder,
	copyFile,
	watchFolder,
	handlePdfFile,
} = require('../../index')

// stop main watcher
mainWatcher.close()

const testParameters = {
	mo: '0000804646',
	lot: '1950248201',
	pn: '4100123',
	com: '100',
}

describe('Read JSON File', function() {
	const jsonPath = path.resolve(__dirname, 'json', 'jsonTest.json')
	const jsonObj = readJson(jsonPath)

	it('should be a JSON object', function(done) {
		expect(jsonObj).to.be.an('object')
		done()
	})

	it('should have all keys', function(done) {
		expect(jsonObj).to.have.property('boolean')
		expect(jsonObj).to.have.property('string')
		expect(jsonObj).to.have.property('number')

		// false positive tests
		expect(jsonObj).to.not.have.property('test')
		expect(jsonObj).to.not.have.property('array')

		done()
	})

	it('should have the right values', function(done) {
		expect(jsonObj.boolean).to.equal(true)
		expect(jsonObj.string).to.equal('test')
		expect(jsonObj.number).to.equal(123)

		done()
	})
})

describe('Handle Template', function() {
	const template = path.resolve(__dirname, 'newFolder', '$com$', '$pn$', '$lot$', '$mo$')
	const templateResult = path.resolve(
		__dirname,
		'newFolder',
		testParameters.com,
		testParameters.pn,
		testParameters.lot,
		testParameters.mo
	)
	const jsonResultPath = path.resolve(__dirname, 'json', 'resultTest.json')
	const jsonResultObj = readJson(jsonResultPath)

	const resolvedTemplate = resolveTemplate(jsonResultObj, template)

	it('should replace variables from JSON object', function(done) {
		expect(resolvedTemplate).to.be.an('string')
		expect(resolvedTemplate).to.equal(templateResult)
		done()
	})

	it('should create new folder', function(done) {
		// delete folder if exists
		const newTestFolder = path.resolve(__dirname, 'newFolder', testParameters.com)
		if (fs.existsSync(newTestFolder)) {
			fse.removeSync(newTestFolder)
		}

		const folderCreated = createFolder(resolvedTemplate)
		const folderCreatedCheck = fs.existsSync(resolvedTemplate)

		expect(folderCreated).to.equal(true)
		expect(folderCreatedCheck).to.equal(true)
		done()
	})
})

describe('Read QR Code', function() {
	this.timeout(15000)

	let testWatcher
	const testWatchFolder = path.resolve(__dirname, 'watch')
	const newTestFolder = path.resolve(__dirname, 'newFolder', testParameters.com)
	const originalPdfTestFilePath = path.resolve(__dirname, 'docs', 'qrTest.pdf')
	const testPdfTestFilePath = path.resolve(__dirname, 'watch', 'qrTest.pdf')

	// delete folder if exists
	if (fs.existsSync(newTestFolder)) {
		fse.removeSync(newTestFolder)
	}

	copyFile(originalPdfTestFilePath, testPdfTestFilePath)

	it('should read QR code from pdf file', function(done) {
		testWatcher = watchFolder(testWatchFolder, handlePdfFile)

		setTimeout(done, 10000)
	})

	it('should move the pdf file', function(done) {
		testWatcher.close()

		const testAction = readJson(path.resolve(__dirname, '../', 'config', 'types.json'))
		const resolvedFileTemplate = resolveTemplate(testParameters, testAction.test.path)

		const fileFound = fs.existsSync(resolvedFileTemplate)
		if (!fileFound) {
			console.error('File Not Found')
			console.error(resolvedFileTemplate)
		}
		expect(fileFound).to.equal(true)
		done()
	})

	it('should clean test files', function(done) {
		if (fs.existsSync(newTestFolder)) {
			fse.removeSync(newTestFolder)
		}

		fse.emptyDirSync(path.resolve(testWatchFolder, 'temp'))
		done()
	})
})
