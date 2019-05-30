# tav-ocr

TAV-OCR was developed to allow easy scan of a QR code on any document following by any action.
The default action is `move` which will read the QR code from a scanned pdf file, with a random printer generate name, and move it to a shared folder while changing the file name to a more human-friendly name.

This project is supported by [TAV Medical Ltd.](https://tavmedical.com)

## Installation

1. Download and install [Node.js](https://nodejs.org/en/).
2. [Fork](https://github.com/liorsh69/tav-ocr/fork)/[Download](https://github.com/liorsh69/tav-ocr/archive/master.zip)/[Git clone](https://help.github.com/articles/duplicating-a-repository/) this repository.
3. Run install.bat (just doing `npm install` to install dependencies).
4. Run using `node index.js` or Install as a service.
5. Change configuration in `./config` folder

### Install As A Service

1. Open a new command prompt window.
2. Run `npm run-script install-windows-service` to install a new service named `tav-ocr`.
3. Open Services & start the service.

-   To uninstall run `npm run-script uninstall-windows-service`.

### Log File

All logs are being saved in `console.log` to allow easy debugging when running as a service.

## Configure

-   All configuration files are located in `./config` folder.
-   Contributors: use `./config/private` to continue using this project while making changes in the branch.

### settings.json

-   General app settings.

| Argument      | Required? | Details                                                                                |
| ------------- | --------- | -------------------------------------------------------------------------------------- |
| folderToWatch | \*        | Folder to watch for files                                                              |
| smtp          |           | Using [Nodemailer Single Connection](https://nodemailer.com/smtp/#1-single-connection) |

### coordinates.json

-   QR code x,y scan coordinates.

```
{
"array": [
    {
        "x": 145, // x position to **start** the square
        "y": 100, // y position to **start** the square
        "squareSize": 100 // square size to scan QR code
    },
    {"x": 125, "y": 70, "squareSize": 135 }...
]
}

```

### types.json

-   action types

```
{
    "action-name": {
        // File destination template
        // $var_name$ will be replaced using QR code data
        "path": "\\\\SERVER\\Path\\Quality Assurance\\$pn$\\$lot$\\MO-$pn$-$lot$-$mo$-$today$.pdf",

        /** Function name to run
        * Receive 3 arguments:
        * @param {String} pdfFile - PDF file path
        * @param {Object} jsonResult - QR json result
        * @param {Object} action - action type json object
        */
        "function": "move",

        // [Nodemailer Single Connection](https://nodemailer.com/smtp/#1-single-connection)
        "smtp": {
            "email": "group@domain.com",
            "subject": "MO-$pn$-$lot$-$mo$"
        }
    },
    "action-name-2": ...
}
```

## Contributing

When contributing to this repository, please **first discuss** the change you wish to make via **issue** or **email** before making a push.

-   When writing/rewriting make sure to comment with as much information as you can
-   Make sure to test as you write to prevent any errors
-   **Always** push to dev branch
-   If approved - the changes are going to get tested using dev branch

## Dependencies

-   [winston](https://github.com/winstonjs/winston)
-   [chokidar](https://github.com/paulmillr/chokidar)
-   [fs-extra](https://github.com/jprichardson/node-fs-extra)
-   [jimp](https://github.com/oliver-moran/jimp)
-   [moment](https://github.com/moment/moment/)
-   [nodemailer](https://github.com/nodemailer/nodemailer)
-   [pdf-poppler](https://github.com/kb47/pdf-poppler)
-   [qrcode-reader](https://github.com/edi9999/jsqrcode)
-   [shelljs](https://github.com/shelljs/shelljs)
-   [winser](https://github.com/jfromaniello/winser)
-   [chai](https://github.com/chaijs/chai)
-   [mocha](https://github.com/mochajs/mocha)
