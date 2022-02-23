#!/usr/bin/env bash
set -e

mkdir -p build/
npx terser -c -m  <recaptcha_assessment.js >build/recaptcha_assessment.js
CONFIG=$(
	npx terser -c -m -- recaptcha_enrich.js |
	python3 -m base64 |
	tr -d '\n'
)

jq \
	--arg script "$CONFIG" \
	'.data.parameters.script = $script' \
	< config.template.json \
	> build/recaptcha_enrich.json
