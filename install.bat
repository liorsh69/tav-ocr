@ECHO OFF
ECHO Installing Dependencies...
npm install
ECHO Dependencies Installed
ECHO ------------------------------------
ECHO Running Audit Fix
npm audit fix