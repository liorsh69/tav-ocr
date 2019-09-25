const { expect } = require('chai')
const { resolveTemplate } = require('./template')
const { initSql } = require('./mssql')
const config = require('../settings')

const keysRegex = new RegExp(`\\$.*\\$`, 'g')

const TEST_OBJECT = {
	anyKey: 'canBeUsed',
	something: 'like_this',
	justAnotherKey: 'another_key',
	bla: 'BlaBla',
}
const TEST_OBJECT_MO_FULL = {
	type: 'test',
	mo: '0000602872',
	pn: '4100771',
	lot: '1960287201T2',
	com: '100',
}
const TEST_OBJECT_MO_LOT = {
	type: 'test',
	lot: '1960287201T2',
}

const TEST_TEMPLATE =
	'\\\\server\\folder\\$anyKey$\\$something$\\$justAnotherKey$\\$bla$\\$justAnotherKey$-$anyKey$.file'
const TEST_TEMPLATE_RESOLVED = `\\\\server\\folder\\${TEST_OBJECT.anyKey}\\${TEST_OBJECT.something}\\${TEST_OBJECT.justAnotherKey}\\${TEST_OBJECT.bla}\\${TEST_OBJECT.justAnotherKey}-${TEST_OBJECT.anyKey}.file`

const TEST_TEMPLATE_MO = '\\\\server\\tests\\newFolder\\$com$\\$pn$\\$lot$\\$mo$\\TEST-$pn$-$lot$-$mo$.pdf'
const TEST_TEMPLATE_MO_RESOLVED = `\\\\server\\tests\\newFolder\\${TEST_OBJECT_MO_FULL.com}\\${TEST_OBJECT_MO_FULL.pn}\\${TEST_OBJECT_MO_FULL.lot}\\${TEST_OBJECT_MO_FULL.mo}\\TEST-${TEST_OBJECT_MO_FULL.pn}-${TEST_OBJECT_MO_FULL.lot}-${TEST_OBJECT_MO_FULL.mo}.pdf`

describe('resolveTemplate', function() {
	this.timeout(10000)

	it('should resolve a template with full JSON Object - Test', () => {
		return new Promise(async resolve => {
			const resolvedTemplate = await resolveTemplate(TEST_OBJECT, TEST_TEMPLATE)
			expect(resolvedTemplate).to.equal(TEST_TEMPLATE_RESOLVED)

			const unresolvedTemplate = resolvedTemplate.match(keysRegex)
			expect(unresolvedTemplate).to.equal(null)
			resolve()
		})
	})

	it('should resolve a template with full JSON Object - MO', () => {
		return new Promise(async resolve => {
			const resolvedTemplate = await resolveTemplate(TEST_OBJECT_MO_FULL, TEST_TEMPLATE_MO)
			expect(resolvedTemplate).to.equal(TEST_TEMPLATE_MO_RESOLVED)

			const unresolvedTemplate = resolvedTemplate.match(keysRegex)
			expect(unresolvedTemplate).to.equal(null)
			resolve()
		})
	})

	it('should initiate MS SQL client', () => {
		return new Promise(async resolve => {
			const mssqlSettings = config.get('settings:mssql')
			await initSql(mssqlSettings)
			resolve()
		})
	})

	it('should resolve a template with partial JSON Object - MO', () => {
		return new Promise(async resolve => {
			const resolvedTemplate = await resolveTemplate(TEST_OBJECT_MO_LOT, TEST_TEMPLATE_MO)
			expect(resolvedTemplate).to.equal(TEST_TEMPLATE_MO_RESOLVED)

			const unresolvedTemplate = resolvedTemplate.match(keysRegex)
			expect(unresolvedTemplate).to.equal(null)
			resolve()
		})
	})
})
