#!/bin/bash
cd "$(dirname "$0")"
exec node_modules/.bin/vite --port 5181
