#!/bin/sh
set -eu
mc alias set local "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
mc mb --ignore-existing local/bhumiraj-public
mc mb --ignore-existing local/bhumiraj-private
mc anonymous set download local/bhumiraj-public
mc anonymous set none local/bhumiraj-private
mc cors set local/bhumiraj-public /cors.xml || echo "Warning: unable to apply CORS for bhumiraj-public"
mc cors set local/bhumiraj-private /cors.xml || echo "Warning: unable to apply CORS for bhumiraj-private"
# Incomplete direct uploads are short-lived; READY private records are not placed under uploads/.
mc ilm rule add --expire-days 1 local/bhumiraj-private/uploads || true
