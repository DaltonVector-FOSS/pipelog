#Requires -Version 5.1
<#
.SYNOPSIS
  Download pipelog from GitHub Releases and install pipelog.exe (Windows, no bash).

.DESCRIPTION
  Expects release assets named: pipelog-<rust-triple>.zip
  Example: pipelog-x86_64-pc-windows-gnu.zip (archive contains pipelog.exe)

  Set PIPELOG_DOWNLOAD_URL to bypass GitHub URL logic (version check skipped).
  Override asset triple with PIPELOG_WINDOWS_TRIPLE (e.g. x86_64-pc-windows-msvc) if you ship MSVC builds instead.
  Set PIPELOG_UPDATE_PATH=0 to skip adding the install dir to your user PATH.
  If an existing pipelog.exe cannot be executed (e.g. Application Control / Smart App Control blocks it), the script skips the version check and reinstalls over that path.

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

# GitHub API requests should send a User-Agent (some environments return 403 otherwise).
$script:GitHubApiUserAgent = 'pipelog-windows-install-script'

function Write-Info([string] $Message) {
    Write-Host $Message
}

function Fail([string] $Message) {
    [Console]::Error.WriteLine("Error: $Message")
    exit 1
}

# Strip surrounding whitespace and a single leading "v" (matches install.sh normalize_version).
function Normalize-Version([string] $Value) {
    if ($null -eq $Value) { return '' }
    $v = $Value.Trim()
    if ($v.StartsWith('v', [StringComparison]::OrdinalIgnoreCase)) {
        $v = $v.Substring(1).Trim()
    }
    return $v
}

function Resolve-VersionTag {
    if ($Version -eq 'latest') { return 'latest' }
    if ($Version.StartsWith('v')) { return $Version }
    return "v$Version"
}

function Get-LatestNormalizedTag {
    $api = "https://api.github.com/repos/$Repo/releases/latest"
    $headers = @{
        'User-Agent' = $script:GitHubApiUserAgent
        'Accept'     = 'application/vnd.github+json'
    }
    try {
        $rel = Invoke-RestMethod -Uri $api -Headers $headers -Method Get
        if (-not $rel.tag_name) {
            Fail "GitHub API returned no tag_name for $Repo."
        }
        return (Normalize-Version $rel.tag_name)
    } catch {
        Fail "Could not resolve latest release for $Repo. Set PIPELOG_VERSION to a tag (e.g. 0.1.0) or PIPELOG_DOWNLOAD_URL. Details: $_"
    }
}

function Get-DesiredNormalized {
    if ($Version -eq 'latest') {
        return Get-LatestNormalizedTag
    }
    return (Normalize-Version (Resolve-VersionTag))
}

# Last whitespace-separated token of `pipelog --version` output (matches install.sh installed_version awk).
# Returns $null if the binary cannot be run or output cannot be parsed (caller may reinstall).
function TryGet-InstalledVersionLastToken([string] $ExePath, [ref] $Detail) {
    $Detail.Value = $null
    try {
        $pieces = @(
            & $ExePath @('--version') 2>&1 | ForEach-Object {
                if ($_ -is [System.Management.Automation.ErrorRecord]) {
                    return $_.Exception.Message
                }
                return "$_"
            }
        )
        $output = ($pieces -join "`n").Trim()
        if ($output -match '(?i)application control|blocked this file|has been blocked|access is denied') {
            $Detail.Value = $output
            return $null
        }
        if (-not $output) {
            $Detail.Value = 'empty output'
            return $null
        }
        $tokens = @($output -split '\s+' | Where-Object { $_ })
        if ($tokens.Length -eq 0) {
            $Detail.Value = "unparseable: $output"
            return $null
        }
        return $tokens[$tokens.Length - 1]
    } catch {
        $Detail.Value = "$_"
        return $null
    }
}

# Mirrors Rust dirs::config_dir() + pipelog/config.json on Windows (%APPDATA%\Roaming).
function Test-PipelogCliAuthenticated {
    if (-not $env:APPDATA) {
        return $false
    }
    $cfg = Join-Path $env:APPDATA 'pipelog\config.json'
    if (-not (Test-Path -LiteralPath $cfg)) {
        return $false
    }
    try {
        $json = Get-Content -LiteralPath $cfg -Raw -ErrorAction Stop | ConvertFrom-Json
        $t = $json.auth_token
        if ($null -eq $t) {
            return $false
        }
        return ($t.ToString().Trim().Length -gt 0)
    } catch {
        return $false
    }
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

    $dst = Join-Path $InstallDir $BinName
    $hadExisting = Test-Path -LiteralPath $dst

    if (-not $DownloadUrl) {
        if (Test-Path -LiteralPath $dst) {
            $desired = Get-DesiredNormalized
            $verDetail = $null
            $rawInstalled = TryGet-InstalledVersionLastToken $dst ([ref] $verDetail)
            if ($null -ne $rawInstalled) {
                $current = Normalize-Version $rawInstalled
                if ($current -eq $desired) {
                    Write-Info "$BinName is already installed and up to date ($current)."
                    exit 0
                }
                Write-Info "$BinName is installed ($current); updating to $desired..."
            } else {
                $hint = $verDetail
                if ($hint) {
                    Write-Warning "Could not run existing $BinName to check version ($hint). Re-downloading to $dst."
                } else {
                    Write-Warning "Could not read version from existing $BinName. Re-downloading to $dst."
                }
                Write-Info "Installing $desired..."
            }
        }
    } else {
        Write-Info "Installing $BinName (custom download URL; version check skipped)..."
    }

    $triple = Get-WindowsTriple
    $url = Get-DownloadUrl $triple
    $workDir = Join-Path ([System.IO.Path]::GetTempPath()) ('pipelog-install-' + [Guid]::NewGuid().ToString('n'))
    New-Item -ItemType Directory -Path $workDir | Out-Null
    try {
        if (-not $DownloadUrl) {
            Write-Info "Downloading $BinName ($triple) from GitHub Releases..."
        } else {
            Write-Info "Downloading $BinName ($triple)..."
        }
        $zipPath = Join-Path $workDir 'pipelog.zip'
        try {
            Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing -Headers @{
                'User-Agent' = $script:GitHubApiUserAgent
            }
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
        Copy-Item -LiteralPath $srcExe -Destination $dst -Force

        $addedPath = $false
        if ($env:PIPELOG_UPDATE_PATH -ne '0') {
            $addedPath = Add-UserPathEntry $InstallDir
        }

        Write-Info "Installed $BinName to $dst"

        if (-not $hadExisting) {
            Write-Info ''
            Write-Info 'Verify (open a new terminal if PATH was just updated):'
            Write-Info '  pipelog --version'
            Write-Info ''
        }

        if ($addedPath) {
            Write-Info "Added $InstallDir to your user PATH. Open a new PowerShell or CMD window."
            if (-not $hadExisting) {
                Write-Info ''
            }
        }

        # Match install.sh: only suggest login on fresh binary install — and skip if CLI config has a token.
        if (-not $hadExisting) {
            if (Test-PipelogCliAuthenticated) {
                Write-Info 'Already signed in (CLI config found).'
            } else {
                Write-Info 'Next:'
                Write-Info '  pipelog auth login'
            }
        }
    } finally {
        Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Main
