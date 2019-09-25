/** file.js
 *  Handle QR Codes
 */

const Jimp = require('jimp')
const path = require('path')
const getImageData = require('get-image-data')
const jsQR = require('jsqr')
const { logger } = require('./logger')

const DEV_MODE = !false

/** convert image QR code to text
 * @param {String} jpgFile image path
 */
function readQR(jpgFile, coordinates, coordinatesIdx) {
	return Jimp.read(jpgFile)
		.catch(logger.error)
		.then(image => {
			return new Promise((resolve, reject) => {
				const jpgFileExt = path.extname(jpgFile)
				const jpgFileName = path.basename(jpgFile, jpgFileExt).replace('-1', '')
				const tempImgFolder = path.dirname(jpgFile)

				// crop image to get only the QR code
				// use this to get the coordinates
				// https://www.tutorialspoint.com/crop_image_online.htm
				const QRimage = image
					.quality(100)
					.crop(coordinates.x, coordinates.y, coordinates.squareSize, coordinates.squareSize)
					.quality(100)
					.resize(500, 500)

				// save temp images in dev mode
				if (DEV_MODE) {
					QRimage.write(path.join(tempImgFolder, jpgFileName + '-test-' + coordinatesIdx + '.jpg'))
				}

				// read QRimage and resolve with json object
				getImageData(QRimage, function(err, info) {
					if (err) {
						logger.error(`${jpgFileName} - getImageData Error: ${err}`)
						resolve(false)
					}
					const { data, width, height } = info

					const code = jsQR(data, width, height)
					if (code) {
						logger.info(`${jpgFileName} - jsQR Result: ${code.data}`)
						resolve(code.data)
					} else {
						logger.info(`${jpgFileName} - jsQR Result Not Found: ${code}`)
						resolve(false)
					}
				})
			})
		})
}

module.exports = { readQR }
