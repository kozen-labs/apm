@ECHO off
SETLOCAL

:: Locate node
WHERE node >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
  ECHO [error] Node.js not found. Install Node.js 18+ and ensure it is on your PATH.
  EXIT /B 1
)

:: Run via compiled dist or ts-node fallback
SET "SCRIPT_DIR=%~dp0"
SET "DIST=%SCRIPT_DIR%..\dist\cli\index.js"
SET "SRC=%SCRIPT_DIR%..\src\cli\index.ts"

IF EXIST "%DIST%" (
  node "%DIST%" %*
) ELSE (
  WHERE npx >nul 2>&1
  IF %ERRORLEVEL% EQU 0 (
    npx ts-node "%SRC%" %*
  ) ELSE (
    ECHO [error] Run 'npm run build' first to compile the TypeScript source.
    EXIT /B 1
  )
)
ENDLOCAL
