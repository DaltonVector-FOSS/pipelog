#Requires -Version 5.1
<#
.SYNOPSIS
  Download pipelog from GitHub Releases and install pipelog.exe (Windows, no bash).

.DESCRIPTION
  Expects release assets named: pipelog-<rust-triple>.zip
  Example: pipelog-x86_64-pc-windows-gnu.zip (archive contains pipelog.exe)

  Set PIPELOG_DOWNLOAD_URL to bypass GitHub URL logic.
  Override asset triple with PIPELOG_WINDOWS_TRIPLE (e.g. x86_64-pc-windows-msvc) if you ship MSVC builds instead.
  Set PIPELOG_UPDATE_PATH=0 to skip adding the install dir to your user PATH.

.EXAMPLE
  # PowerShell 7+ (or Windows Terminal default):
  #   irm https://raw.githubusercontent.com/DaltonVector-FOSS/pipelog/main/scripts/install.ps1 | iex
  # Windows PowerShell 5.1, CMD "Run", or a .bat one-liner:
  #   powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/DaltonVector-FOSS/pipelog/main/scripts/install.ps1').Content)"
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Repo = if ($env:PIPELOG_REPO) { $env:PIPELOG_REPO } else { 'DaltonVector-FOSS/pipelog' }
$Version = if ($env:PIPELOG_VERSION) { $env:PIPELOG_VERSION } else { 'latest' }
$DefaultInstallDir = Join-Path $env:USERPROFILE '.local\bin'
$InstallDir = if ($env:PIPELOG_INSTALL_DIR) { $env:PIPELOG_INSTALL_DIR } else { $DefaultInstallDir }
$DownloadUrl = if ($env:PIPELOG_DOWNLOAD_URL) { $env:PIPELOG_DOWNLOAD_URL } else { '' }
$BinName = 'pipelog.exe'

function Write-Info([string] $Message) {
    Write-Host $Message
}

function Fail([string] $Message) {
    [Console]::Error.WriteLine("Error: $Message")
    exit 1
}

function Resolve-VersionTag {
    if ($Version -eq 'latest') { return 'latest' }
    if ($Version.StartsWith('v')) { return $Version }
    return "v$Version"
}

function Get-WindowsTriple {
    if ($env:PIPELOG_WINDOWS_TRIPLE) {
        return $env:PIPELOG_WINDOWS_TRIPLE
    }
    $arch = $env:PROCESSOR_ARCHITECTURE
    # WoW64: PROCESSOR_ARCHITEW6432 is set when 32-bit PowerShell runs on 64-bit Windows
    if ($env:PROCESSOR_ARCHITEW6432) {
        $arch = $env:PROCESSOR_ARCHITEW6432
    }
    switch -Regex ($arch.ToUpperInvariant()) {
        'AMD64' { return 'x86_64-pc-windows-gnu' }
        'ARM64' { return 'aarch64-pc-windows-gnu' }
        default {
            Fail "Unsupported architecture: $arch. Supported: AMD64, ARM64."
        }
    }
}

function Get-DownloadUrl([string] $Triple) {
    if ($DownloadUrl) { return $DownloadUrl }
    $tag = Resolve-VersionTag
    $asset = "pipelog-$Triple.zip"
    if ($tag -eq 'latest') {
        return "https://github.com/$Repo/releases/latest/download/$asset"
    }
    return "https://github.com/$Repo/releases/download/$tag/$asset"
}

function Find-InstalledBinary([string] $ExtractRoot) {
    $direct = Join-Path $ExtractRoot $BinName
    if (Test-Path -LiteralPath $direct) { return (Resolve-Path -LiteralPath $direct).Path }
    $found = Get-ChildItem -Path $ExtractRoot -Filter $BinName -Recurse -File -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($found) { return $found.FullName }
    Fail "Archive extracted, but '$BinName' was not found under $ExtractRoot."
}

function Add-UserPathEntry([string] $Directory) {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not $machine) { $machine = '' }
    $parts = $machine.Split(';', [System.StringSplitOptions]::RemoveEmptyEntries)
    $norm = (Resolve-Path -LiteralPath $Directory).Path.TrimEnd('\')
    foreach ($p in $parts) {
        try {
            if ((Resolve-Path -LiteralPath $p).Path.TrimEnd('\') -ieq $norm) { return $false }
        } catch {
            continue
        }
    }
    $suffix = if ($machine.EndsWith(';') -or $machine.Length -eq 0) { '' } else { ';' }
    [Environment]::SetEnvironmentVariable('Path', "$machine$suffix$norm", 'User')
    return $true
}

function Main {
    if ($env:OS -ne 'Windows_NT') {
        Fail 'This installer is for Windows only.'
    }

    $triple = Get-WindowsTriple
    $url = Get-DownloadUrl $triple
    $workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("pipelog-install-" + [Guid]::NewGuid().ToString('n'))
    New-Item -ItemType Directory -Path $workDir | Out-Null
    try {
        $zipPath = Join-Path $workDir 'pipelog.zip'
        Write-Info "Downloading $BinName ($triple) from GitHub Releases..."
        try {
            Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
        } catch {
            Fail "Failed to download release asset from: $url`n$_"
        }
        if (-not (Test-Path -LiteralPath $zipPath) -or ((Get-Item -LiteralPath $zipPath).Length -eq 0)) {
            Fail 'Downloaded archive is empty.'
        }

        $extractDir = Join-Path $workDir 'out'
        New-Item -ItemType Directory -Path $extractDir | Out-Null
        Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force

        $srcExe = Find-InstalledBinary $extractDir
        if (-not (Test-Path -LiteralPath $InstallDir)) {
            New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
        }
        $dst = Join-Path $InstallDir $BinName
        Copy-Item -LiteralPath $srcExe -Destination $dst -Force

        $addedPath = $false
        if ($env:PIPELOG_UPDATE_PATH -ne '0') {
            $addedPath = Add-UserPathEntry $InstallDir
        }

        Write-Info "Installed $BinName to $dst"
        Write-Info ''
        Write-Info 'Verify (open a new terminal if PATH was just updated):'
        Write-Info "  pipelog --version"
        Write-Info ''
        if ($addedPath) {
            Write-Info "Added $InstallDir to your user PATH. Open a new PowerShell or CMD window."
            Write-Info ''
        }
        Write-Info 'Next:'
        Write-Info '  pipelog auth login'
    } finally {
        Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Main
