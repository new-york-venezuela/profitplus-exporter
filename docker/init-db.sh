#!/bin/bash
set -e

cd "$(dirname "$0")"

# Run Python init script using docker run with shared network
docker run --rm \
  --network docker_profitplus-network \
  -v "$(pwd)/mssql/init.sql":/scripts/init.sql \
  -v "$(pwd)/mssql/data.sql":/scripts/data.sql \
  -v "$(pwd)/init.py":/init.py \
  python:3.9-slim \
  bash -c 'pip install pymssql > /dev/null 2>&1 && python /init.py'
