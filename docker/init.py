#!/usr/bin/env python3
import pymssql
import sys
import time

# Connection params
server = "profitplus-erp-mock"
port = 1433
username = "sa"
password = "YourStr0ngP@ssw0rd"

# Wait for server to be ready
print("Waiting for SQL Server to be ready...")
for i in range(120):
    try:
        conn = pymssql.connect(
            server=server,
            port=port,
            user=username,
            password=password,
            timeout=2,
            autocommit=True
        )
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        conn.close()
        print("SQL Server is ready!")
        break
    except Exception as e:
        if i % 20 == 0:
            print(f"Attempt {i+1}/120: Waiting for SQL Server...")
        time.sleep(1)
else:
    print("ERROR: SQL Server did not become ready in time")
    sys.exit(1)

time.sleep(2)

# Run init script
print("\nRunning database initialization...")
try:
    conn = pymssql.connect(
        server=server,
        port=port,
        user=username,
        password=password,
        autocommit=True
    )
    cursor = conn.cursor()

    with open("/scripts/init.sql", "r") as f:
        init_sql = f.read()

    # Execute each statement separately
    for statement in init_sql.split("GO"):
        statement = statement.strip()
        if statement:
            try:
                cursor.execute(statement)
            except Exception as e:
                # Some statements may fail, log but continue
                pass

    conn.close()
    print("Database initialization complete!")
except Exception as e:
    print(f"ERROR during initialization: {e}")
    sys.exit(1)

time.sleep(2)

# Run data script
print("Running data population...")
try:
    conn = pymssql.connect(
        server=server,
        port=port,
        user=username,
        password=password,
        database="ProfitPlus",
        autocommit=True
    )
    cursor = conn.cursor()

    with open("/scripts/data.sql", "r") as f:
        data_sql = f.read()

    for statement in data_sql.split("GO"):
        statement = statement.strip()
        if statement:
            try:
                cursor.execute(statement)
            except Exception as e:
                pass

    conn.close()
    print("Data population complete!")
except Exception as e:
    print(f"ERROR during data population: {e}")
    sys.exit(1)

print("\nDatabase initialization complete!")
print("ProfitPlus database is ready for use.")
