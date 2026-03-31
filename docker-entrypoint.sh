#!/bin/sh
# Inject GA_MEASUREMENT_ID into index.html if set
if [ -n "$GA_MEASUREMENT_ID" ]; then
  find /app/dist -name 'index.html' -exec sed -i "s/__GA_MEASUREMENT_ID__/$GA_MEASUREMENT_ID/g" {} +
fi
exec "$@"
