$ErrorActionPreference = "Stop"

$uiDir = "$env:APPDATA\RouteX\work\ui"
$zipUrl = "https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip"
$zipPath = Join-Path $uiDir "metacubexd.zip"

Write-Host "Creating UI directory: $uiDir"
if (!(Test-Path -Path $uiDir)) {
    New-Item -ItemType Directory -Force -Path $uiDir
}

Write-Host "Downloading MetaCubeXD from $zipUrl..."
Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath

Write-Host "Extracting to $uiDir..."
Expand-Archive -Path $zipPath -DestinationPath $uiDir -Force

Write-Host "Cleaning up..."
Remove-Item -Path $zipPath -Force

Write-Host "Done! MetaCubeXD installed to $uiDir\metacubexd-gh-pages"
Write-Host "You can now open the dashboard in RouteX."
