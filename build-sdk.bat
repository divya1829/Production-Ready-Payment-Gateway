@echo off
cd checkout-widget
call npm install
call npm run build
copy dist\checkout.js ..\checkout\public\checkout.js
echo SDK built and copied to checkout/public/
