@echo off
setlocal
cd /d "%~dp0"
start "InfiniteCraft Groq Proxy" cmd /k "set GROQ_API_KEY=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&& set GROQ_MODEL=llama-3.1-8b-instant&& node tools\infinitecraft-groq-proxy.js"
timeout /t 2 /nobreak >nul
start "" "%~dp0GeneratedBuilds\EaglercraftX_1.8_Offline_en_US.html"
