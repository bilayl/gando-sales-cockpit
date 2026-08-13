@echo off
cd /d %~dp0
call vercel link
call vercel deploy --prod
