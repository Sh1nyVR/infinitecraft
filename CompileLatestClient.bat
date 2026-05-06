@echo off
title CompileLatestClient

set "JAVA17="

for /d %%J in ("C:\Program Files\Eclipse Adoptium\jdk-17*") do set "JAVA17=%%~fJ\bin\java.exe"
if not defined JAVA17 for /d %%J in ("C:\Program Files\Java\jdk-17*") do set "JAVA17=%%~fJ\bin\java.exe"
if not defined JAVA17 for /d %%J in ("%LOCALAPPDATA%\Programs\Eclipse Adoptium\jdk-17*") do set "JAVA17=%%~fJ\bin\java.exe"
if not defined JAVA17 for /d %%J in ("%LOCALAPPDATA%\Programs\Java\jdk-17*") do set "JAVA17=%%~fJ\bin\java.exe"

if not defined JAVA17 (
	echo Could not find Java 17.
	echo Install a Java 17 JDK, then run this script again.
	echo Current Java on PATH:
	java -version
	pause
	exit /b 1
)

"%JAVA17%" -cp "buildtools/BuildTools.jar" net.lax1dude.eaglercraft.v1_8.buildtools.gui.CompileLatestClientGUI
del /S /Q "##TEAVM.TMP##\*"
rmdir /S /Q "##TEAVM.TMP##"
pause
