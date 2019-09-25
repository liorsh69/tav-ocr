const path = require('path')
const { logger, resolveTemplate, createFolder, moveFile } = require('../helpers')

/**	Action Function - move
 * Resolve templates & move file
 *
 * @param {String} pdfFile
 * @param {Object} jsonResult
 * @param {Object} action
 */
async function move(pdfFile, jsonResult, action) {
	return new Promise(async resolve => {
		// resolve file destination from QR JSON result
		const finalFileDestination = await resolveTemplate(jsonResult, action.path)
		if (!finalFileDestination) {
			logger.error(`finalFileDestination error: ${finalFileDestination}`)
			resolve(false)
			return
		}

		const finalDestinationFolder = path.dirname(finalFileDestination)
		if (!finalDestinationFolder) {
			logger.error(`finalDestination error: ${finalDestinationFolder}`)
			resolve(false)
			return
		}

		// create finalDestinationFolder folder if doesn't exists
		const folderCreated = await createFolder(finalDestinationFolder)
		const fileMoved = await moveFile(pdfFile, finalFileDestination)

		resolve({
			result: folderCreated && fileMoved,
			smtp: {
				link: finalFileDestination,
			},
		})
	})
}

module.exports = { move }
