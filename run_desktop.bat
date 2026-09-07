@echo off
chcp 65001 > nul
title DuoJukebox Desktop App
cd /d "%~dp0"
python desktop.py
pause
