#!/usr/bin/env bash

rm -rf compiled
tsc
cp -r src/assets compiled/assets
cp package.json compiled/package.json
cd compiled
npm publish cwl-svg