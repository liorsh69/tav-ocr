const path = require('path')
const { expect } = require('chai')
const { readJson } = require('./readJson')

const testsFolder = path.resolve(__dirname, '../', '../', 'tests')
const jsonFile = path.resolve(testsFolder, 'json', 'jsonTest.json')

describe('readJson', function() {
	// a bit longer then the usual timeout(2000ms)
	// normally should take about 2500ms
	this.timeout(5000)

	let jsonObj

	it('should read a json file and convert it to an object', () => {
		return new Promise(async resolve => {
			// read json file
			jsonObj = await readJson(jsonFile)

			expect(jsonObj).to.be.an('object')
			resolve()
		})
	})

	it('should have all keys', () => {
		return new Promise(async resolve => {
			expect(jsonObj).to.have.property('boolean')
			expect(jsonObj).to.have.property('string')
			expect(jsonObj).to.have.property('number')

			// false positive tests
			expect(jsonObj).to.not.have.property('test')
			expect(jsonObj).to.not.have.property('array')

			resolve()
		})
	})

	it('should have the right values', () => {
		return new Promise(async resolve => {
			expect(jsonObj.boolean).to.equal(true)
			expect(jsonObj.string).to.equal('test')
			expect(jsonObj.number).to.equal(123)

			resolve()
		})
	})

	it('should fallback if first file is not found', () => {
		return new Promise(async resolve => {
			// read json file
			const fallbackJsonObj = await readJson('C:\\fake-folder\\file.json', jsonFile)

			expect(fallbackJsonObj).to.be.an('object')

			resolve()
		})
	})
})
