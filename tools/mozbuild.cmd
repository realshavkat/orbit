@echo off
rem Runs a command inside the MozillaBuild shell (needed by mach/surfer on Windows).
rem   tools\mozbuild.cmd npm run build
set CYGWIN=
set INCLUDE=
set LIB=
set MOZILLABUILD=C:\mozilla-build\
"%MOZILLABUILD%msys2\msys2_shell.cmd" -no-start -defterm -full-path -here -c "%*"
