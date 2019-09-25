/** watch.js
 *  Watch folders for new files
 */

const chokidar = require('chokidar')
const { logger } = require('./logger')

/** listen to new files in folder
 * @param {String} folderPath
 * @param {Function} handleNewFile
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

module.exports = { watchFolder }
