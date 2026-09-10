Import-Module WebAdministration
$ServiceName = "ProfitPlus Exporter"

cd "C://Softech Consultores/profitplus-exporter"

# Install new dependencies
Write-Host "Installing dependencies" -ForegroundColor Green
bun install --omit dev

Write-Host "Building app" -ForegroundColor Green
bun run build

# Run migrations
Write-Host "Running app migrations" -ForegroundColor Green
bun run migrate

Write-Host "Running MSSQL migrations" -ForegroundColor Green
bun run migrate:mssql

Write-Host "Running Data Warehouse migrations" -ForegroundColor Green
bun run migrate:dwh

# Restart NSSM
Write-Host "Restarting NSSM service" -ForegroundColor Green
C://Utilities/nssm.exe restart $ServiceName

# Restart IIS
Write-Host "Restarting IIS Website" -ForegroundColor Green
Stop-Website -Name $ServiceName
Start-Website -Name $ServiceName
Write-Host "$ServiceName restarted!"
