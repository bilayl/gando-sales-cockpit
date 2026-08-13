@echo off
cd /d %~dp0
if not exist .env.local copy .env.example .env.local
call npm install
call npm run dev
