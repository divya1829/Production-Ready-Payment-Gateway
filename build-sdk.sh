#!/bin/bash
cd checkout-widget
npm install
npm run build
cp dist/checkout.js ../checkout/public/checkout.js
echo "SDK built and copied to checkout/public/"
