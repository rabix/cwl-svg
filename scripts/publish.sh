#!/usr/bin/env bash

rm -rf compiled
tsc
cd compiled
npm publish cwl-svg