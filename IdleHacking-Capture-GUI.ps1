# Idle Hacking Capture GUI - Windows PowerShell 5.1 compatible
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RuntimeDir = Join-Path $Root 'runtime'
$CapturesDir = Join-Path $Root 'captures'
$StatePath = Join-Path $RuntimeDir 'capture-state.json'
$StopRequestPath = Join-Path $RuntimeDir 'stop.request'
$LogPath = Join-Path $RuntimeDir 'capture.log'
$SettingsPath = Join-Path $RuntimeDir 'gui-settings.json'
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $CapturesDir | Out-Null

function Show-Error([string]$Message) {
    [System.Windows.Forms.MessageBox]::Show($Message, 'Idle Hacking Capture', 'OK', 'Error') | Out-Null
}

function Show-Info([string]$Message) {
    [System.Windows.Forms.MessageBox]::Show($Message, 'Idle Hacking Capture', 'OK', 'Information') | Out-Null
}

function Get-DefaultSettings {
    [ordered]@{
        BraveExe = Join-Path $env:LOCALAPPDATA 'BraveSoftware\Brave-Browser\Application\brave.exe'
        ExtensionDir = Join-Path $Root 'extension'
        ProfileDir = Join-Path $Root 'profile'
        TargetUrl = 'https://www.idlehacking.com'
        HarSegmentSeconds = 60
        CaptureBodies = $true
        IncludeSensitiveNetLog = $true
        EnableBrowserMcp = $false
        AutoMerge = $true
        AutoPackageChatGPT = $true
        CaptureBudgetMB = 450
        ChatGPTZipPartMB = 430
    }
}

function Read-Settings {
    $defaults = Get-DefaultSettings
    if (-not (Test-Path $SettingsPath)) { return $defaults }
    try {
        $saved = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
        foreach ($key in @($defaults.Keys)) {
            if ($null -ne $saved.$key) { $defaults[$key] = $saved.$key }
        }
    } catch {}
    return $defaults
}

function Save-Settings {
    $obj = [ordered]@{
        BraveExe = $txtBrave.Text.Trim()
        ExtensionDir = $txtExtension.Text.Trim()
        ProfileDir = $txtProfile.Text.Trim()
        TargetUrl = $txtUrl.Text.Trim()
        HarSegmentSeconds = [int]$numSegment.Value
        CaptureBodies = [bool]$chkBodies.Checked
        IncludeSensitiveNetLog = [bool]$chkSensitive.Checked
        EnableBrowserMcp = [bool]$chkBrowserMcp.Checked
        AutoMerge = [bool]$chkAutoMerge.Checked
        AutoPackageChatGPT = [bool]$chkAutoPackage.Checked
        CaptureBudgetMB = [int]$numBudget.Value
        ChatGPTZipPartMB = [int]$numZipPart.Value
    }
    $obj | ConvertTo-Json | Set-Content -LiteralPath $SettingsPath -Encoding UTF8
}

function Read-State {
    if (-not (Test-Path $StatePath)) { return $null }
    try { return (Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json) } catch { return $null }
}

function Test-PidAlive($PidValue) {
    if ($null -eq $PidValue) { return $false }
    try {
        $p = Get-Process -Id ([int]$PidValue) -ErrorAction Stop
        return ($null -ne $p)
    } catch { return $false }
}

function Get-LatestCaptureDir {
    $state = Read-State
    if ($null -ne $state -and $state.captureDir -and (Test-Path -LiteralPath $state.captureDir)) {
        return [string]$state.captureDir
    }
    $latest = Get-ChildItem -LiteralPath $CapturesDir -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -First 1
    if ($null -ne $latest) { return $latest.FullName }
    return $null
}

function Quote-Arg([string]$Value) {
    return '"' + $Value.Replace('"', '\"') + '"'
}

function New-HiddenNodeProcess([string[]]$NodeArguments, [hashtable]$Environment = $null) {
    $node = Get-Command node.exe -ErrorAction Stop
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $node.Source
    $quoted = @()
    foreach ($arg in $NodeArguments) { $quoted += (Quote-Arg $arg) }
    $psi.Arguments = ($quoted -join ' ')
    $psi.WorkingDirectory = $Root
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    if ($null -ne $Environment) {
        foreach ($key in $Environment.Keys) {
            $psi.EnvironmentVariables[[string]$key] = [string]$Environment[$key]
        }
    }
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    [void]$process.Start()
    return $process
}

function Validate-Configuration {
    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Node.js (node.exe) was not found in PATH.' }
    if (-not (Test-Path -LiteralPath $txtBrave.Text -PathType Leaf)) { throw "Brave was not found at:`r`n$($txtBrave.Text)" }
    if (-not (Test-Path -LiteralPath (Join-Path $txtExtension.Text 'manifest.json') -PathType Leaf)) { throw "Extension manifest.json was not found under:`r`n$($txtExtension.Text)" }
    if (-not (Test-Path -LiteralPath (Join-Path $Root 'capture.js') -PathType Leaf)) { throw 'capture.js is missing from the installation directory.' }
    if (-not (Test-Path -LiteralPath (Join-Path $Root 'package-for-chatgpt.js') -PathType Leaf)) { throw 'package-for-chatgpt.js is missing from the installation directory.' }
    if ([string]::IsNullOrWhiteSpace($txtUrl.Text)) { throw 'Target URL cannot be blank.' }
    try { [void][Uri]$txtUrl.Text } catch { throw 'Target URL is not a valid URL.' }

    $check = New-HiddenNodeProcess @('-e', "require.resolve('playwright')")
    $check.WaitForExit(10000) | Out-Null
    if (-not $check.HasExited -or $check.ExitCode -ne 0) {
        if (-not $check.HasExited) { try { $check.Kill() } catch {} }
        throw 'Playwright could not be resolved locally. Re-run the installer to repair dependencies.'
    }
}

function Start-Capture {
    try {
        $state = Read-State
        if ($null -ne $state -and $state.status -in @('initializing','starting','running','stopping','packaging') -and (Test-PidAlive $state.pid)) {
            Show-Info "Capture is already running (PID $($state.pid))."
            return
        }

        Validate-Configuration
        Save-Settings
        Remove-Item -LiteralPath $StopRequestPath -Force -ErrorAction SilentlyContinue

        $envMap = @{
            BRAVE_EXE = $txtBrave.Text.Trim()
            EXTENSION_DIR = $txtExtension.Text.Trim()
            PROFILE_DIR = $txtProfile.Text.Trim()
            TARGET_URL = $txtUrl.Text.Trim()
            HAR_SEGMENT_MS = ([int]$numSegment.Value * 1000).ToString()
            CAPTURE_BODIES = $(if ($chkBodies.Checked) { '1' } else { '0' })
            CAPTURE_ALL_BODIES = '0'
            MAX_BODY_BYTES = '4194304'
            NETLOG_MODE = $(if ($chkSensitive.Checked) { 'IncludeSensitive' } else { 'Default' })
            NETLOG_MAX_MB = '512'
            IHS_BRAVE_CDP_PORT = $(if ($chkBrowserMcp.Checked) { '9358' } else { '0' })
            AUTO_MERGE = $(if ($chkAutoMerge.Checked) { '1' } else { '0' })
            AUTO_PACKAGE_CHATGPT = $(if ($chkAutoPackage.Checked) { '1' } else { '0' })
            CAPTURE_BUDGET_MB = ([int]$numBudget.Value).ToString()
            CAPTURE_WARN_MB = ([Math]::Max(1, ([int]$numBudget.Value - 50))).ToString()
            CAPTURE_STOP_HEADROOM_MB = '10'
            CAPTURE_SIZE_CHECK_MS = '1000'
            CHATGPT_ZIP_PART_MB = ([int]$numZipPart.Value).ToString()
        }

        $p = New-HiddenNodeProcess @((Join-Path $Root 'capture.js')) $envMap
        $lblStatus.Text = "Starting capture (PID $($p.Id))..."
        $lblStatus.ForeColor = [System.Drawing.Color]::DarkOrange
        $btnStart.Enabled = $false
        $btnStop.Enabled = $true
    } catch {
        Show-Error $_.Exception.Message
    }
}

function Request-CleanStop {
    try {
        $state = Read-State
        if ($null -eq $state -or -not (Test-PidAlive $state.pid)) {
            Show-Info 'No active capture process was found.'
            return
        }
        [System.IO.File]::WriteAllText($StopRequestPath, [DateTime]::UtcNow.ToString('o'))
        $lblStatus.Text = 'Clean stop requested - finalizing the active HAR...'
        $lblStatus.ForeColor = [System.Drawing.Color]::DarkOrange
        $btnStop.Enabled = $false
    } catch {
        Show-Error $_.Exception.Message
    }
}

function Open-CaptureFolder {
    $dir = Get-LatestCaptureDir
    if ($null -eq $dir) { Show-Info 'No capture session exists yet.'; return }
    Start-Process explorer.exe -ArgumentList @($dir) | Out-Null
}

function Open-AllCaptures {
    Start-Process explorer.exe -ArgumentList @($CapturesDir) | Out-Null
}

function Merge-LatestCapture {
    try {
        $dir = Get-LatestCaptureDir
        if ($null -eq $dir) { throw 'No capture session exists yet.' }
        $script = Join-Path $Root 'merge-hars.js'
        [void](New-HiddenNodeProcess @($script, $dir))
        $lblStatus.Text = 'HAR merge started in the background...'
        $lblStatus.ForeColor = [System.Drawing.Color]::DarkOrange
    } catch { Show-Error $_.Exception.Message }
}

function Recover-LatestJournal {
    try {
        $dir = Get-LatestCaptureDir
        if ($null -eq $dir) { throw 'No capture session exists yet.' }
        $journal = Join-Path $dir 'network.ndjson'
        if (-not (Test-Path -LiteralPath $journal)) { throw "network.ndjson was not found in:`r`n$dir" }
        $script = Join-Path $Root 'journal-to-har.js'
        [void](New-HiddenNodeProcess @($script, $journal))
        $lblStatus.Text = 'Journal recovery started in the background...'
        $lblStatus.ForeColor = [System.Drawing.Color]::DarkOrange
    } catch { Show-Error $_.Exception.Message }
}


function Get-UploadDirForCapture([string]$CaptureDir) {
    if ([string]::IsNullOrWhiteSpace($CaptureDir)) { return $null }
    $session = Split-Path -Leaf $CaptureDir
    return (Join-Path (Join-Path $Root 'ChatGPT Uploads') $session)
}

function Package-LatestForChatGPT {
    try {
        $state = Read-State
        if ($null -ne $state -and (Test-PidAlive $state.pid) -and $state.status -in @('initializing','starting','running','stopping','packaging')) {
            throw 'Stop the active capture cleanly before manually packaging it.'
        }
        $dir = Get-LatestCaptureDir
        if ($null -eq $dir) { throw 'No capture session exists yet.' }
        $script = Join-Path $Root 'package-for-chatgpt.js'
        $outDir = Get-UploadDirForCapture $dir
        [void](New-HiddenNodeProcess @($script, $dir, '--part-mb', ([int]$numZipPart.Value).ToString(), '--output', $outDir))
        $lblStatus.Text = 'ChatGPT upload packaging started in the background...'
        $lblStatus.ForeColor = [System.Drawing.Color]::DarkOrange
    } catch { Show-Error $_.Exception.Message }
}

function Browse-ForFile([System.Windows.Forms.TextBox]$Box, [string]$Filter) {
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    $dlg.Filter = $Filter
    if (Test-Path -LiteralPath $Box.Text) { $dlg.InitialDirectory = Split-Path -Parent $Box.Text }
    if ($dlg.ShowDialog() -eq 'OK') { $Box.Text = $dlg.FileName }
}

function Browse-ForFolder([System.Windows.Forms.TextBox]$Box) {
    $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
    if (Test-Path -LiteralPath $Box.Text) { $dlg.SelectedPath = $Box.Text }
    if ($dlg.ShowDialog() -eq 'OK') { $Box.Text = $dlg.SelectedPath }
}

function New-Label([string]$Text, [int]$X, [int]$Y, [int]$W = 150, [int]$H = 22) {
    $c = New-Object System.Windows.Forms.Label
    $c.Text = $Text; $c.Location = New-Object System.Drawing.Point($X,$Y); $c.Size = New-Object System.Drawing.Size($W,$H)
    return $c
}
function New-TextBox([int]$X, [int]$Y, [int]$W = 535) {
    $c = New-Object System.Windows.Forms.TextBox
    $c.Location = New-Object System.Drawing.Point($X,$Y); $c.Size = New-Object System.Drawing.Size($W,23)
    return $c
}
function New-Button([string]$Text, [int]$X, [int]$Y, [int]$W = 120, [int]$H = 32) {
    $c = New-Object System.Windows.Forms.Button
    $c.Text = $Text; $c.Location = New-Object System.Drawing.Point($X,$Y); $c.Size = New-Object System.Drawing.Size($W,$H)
    return $c
}

$settings = Read-Settings
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Idle Hacking Network Capture'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(860,835)
$form.MinimumSize = New-Object System.Drawing.Size(860,835)
$form.Font = New-Object System.Drawing.Font('Segoe UI',9)

$title = New-Label 'Idle Hacking Network Capture' 18 15 500 32
$title.Font = New-Object System.Drawing.Font('Segoe UI Semibold',16)
$form.Controls.Add($title)

$sub = New-Label 'Brave + extension + segmented HAR + crash-resistant journal + upload-safe ZIP splitting' 20 48 760 24
$sub.ForeColor = [System.Drawing.Color]::DimGray
$form.Controls.Add($sub)

$form.Controls.Add((New-Label 'Brave executable' 20 88 125))
$txtBrave = New-TextBox 150 84 610; $txtBrave.Text = [string]$settings.BraveExe; $form.Controls.Add($txtBrave)
$btnBrowseBrave = New-Button 'Browse...' 770 82 70 27; $form.Controls.Add($btnBrowseBrave)

$form.Controls.Add((New-Label 'Extension folder' 20 124 125))
$txtExtension = New-TextBox 150 120 610; $txtExtension.Text = [string]$settings.ExtensionDir; $form.Controls.Add($txtExtension)
$btnBrowseExtension = New-Button 'Browse...' 770 118 70 27; $form.Controls.Add($btnBrowseExtension)

$form.Controls.Add((New-Label 'Profile folder' 20 160 125))
$txtProfile = New-TextBox 150 156 610; $txtProfile.Text = [string]$settings.ProfileDir; $form.Controls.Add($txtProfile)
$btnBrowseProfile = New-Button 'Browse...' 770 154 70 27; $form.Controls.Add($btnBrowseProfile)

$form.Controls.Add((New-Label 'Target URL' 20 196 125))
$txtUrl = New-TextBox 150 192 690; $txtUrl.Text = [string]$settings.TargetUrl; $form.Controls.Add($txtUrl)

$form.Controls.Add((New-Label 'HAR segment' 20 233 125))
$numSegment = New-Object System.Windows.Forms.NumericUpDown
$numSegment.Location = New-Object System.Drawing.Point(150,229); $numSegment.Size = New-Object System.Drawing.Size(80,23)
$numSegment.Minimum = 10; $numSegment.Maximum = 3600; $numSegment.Value = [decimal]$settings.HarSegmentSeconds
$form.Controls.Add($numSegment)
$form.Controls.Add((New-Label 'seconds (60 recommended)' 238 233 180))

$chkBodies = New-Object System.Windows.Forms.CheckBox
$chkBodies.Text = 'Capture response bodies up to 4 MiB'; $chkBodies.Location = New-Object System.Drawing.Point(440,230); $chkBodies.Size = New-Object System.Drawing.Size(240,24); $chkBodies.Checked = [bool]$settings.CaptureBodies
$form.Controls.Add($chkBodies)

$chkAutoMerge = New-Object System.Windows.Forms.CheckBox
$chkAutoMerge.Text = 'Create merged.har when it fits inside the capture budget'; $chkAutoMerge.Location = New-Object System.Drawing.Point(20,270); $chkAutoMerge.Size = New-Object System.Drawing.Size(350,24); $chkAutoMerge.Checked = [bool]$settings.AutoMerge
$form.Controls.Add($chkAutoMerge)

$chkAutoPackage = New-Object System.Windows.Forms.CheckBox
$chkAutoPackage.Text = 'Automatically package stopped captures for ChatGPT'; $chkAutoPackage.Location = New-Object System.Drawing.Point(390,270); $chkAutoPackage.Size = New-Object System.Drawing.Size(360,24); $chkAutoPackage.Checked = [bool]$settings.AutoPackageChatGPT
$form.Controls.Add($chkAutoPackage)

$chkSensitive = New-Object System.Windows.Forms.CheckBox
$chkSensitive.Text = 'Include sensitive NetLog data (cookies/session/auth data)'; $chkSensitive.Location = New-Object System.Drawing.Point(20,302); $chkSensitive.Size = New-Object System.Drawing.Size(390,24); $chkSensitive.Checked = [bool]$settings.IncludeSensitiveNetLog
$form.Controls.Add($chkSensitive)

$form.Controls.Add((New-Label 'Capture budget' 430 304 105))
$numBudget = New-Object System.Windows.Forms.NumericUpDown
$numBudget.Location = New-Object System.Drawing.Point(535,300); $numBudget.Size = New-Object System.Drawing.Size(80,23)
$numBudget.Minimum = 50; $numBudget.Maximum = 2000; $numBudget.Value = [decimal]$settings.CaptureBudgetMB
$form.Controls.Add($numBudget)
$form.Controls.Add((New-Label 'MiB' 620 304 35))

$form.Controls.Add((New-Label 'ZIP part max' 665 304 90))
$numZipPart = New-Object System.Windows.Forms.NumericUpDown
$numZipPart.Location = New-Object System.Drawing.Point(755,300); $numZipPart.Size = New-Object System.Drawing.Size(75,23)
$numZipPart.Minimum = 25; $numZipPart.Maximum = 430; $numZipPart.Value = [decimal]$settings.ChatGPTZipPartMB
$form.Controls.Add($numZipPart)

$warning = New-Label 'NetLog/HAR data can contain active credentials. Keep capture ZIPs private.' 20 337 405 43
$warning.ForeColor = [System.Drawing.Color]::Firebrick
$form.Controls.Add($warning)
$chkBrowserMcp = New-Object System.Windows.Forms.CheckBox
$chkBrowserMcp.Text = 'Brave MCP: allow localhost debugging (9358)'
$chkBrowserMcp.Location = New-Object System.Drawing.Point(440,342)
$chkBrowserMcp.Size = New-Object System.Drawing.Size(380,32)
$chkBrowserMcp.Checked = [bool]$settings.EnableBrowserMcp
$form.Controls.Add($chkBrowserMcp)
$cdpTip = New-Object System.Windows.Forms.ToolTip
$cdpTip.SetToolTip($chkBrowserMcp, 'Allows trusted local MCP tools to inspect and control only this capture Brave profile while it runs. Local programs can access the endpoint. Disable if not debugging.')

$btnStart = New-Button 'Start Capture' 20 402 150 42; $form.Controls.Add($btnStart)
$btnStop = New-Button 'Stop Capture Cleanly' 180 402 170 42; $form.Controls.Add($btnStop)
$btnLatest = New-Button 'Open Latest Capture' 360 402 155 42; $form.Controls.Add($btnLatest)
$btnAll = New-Button 'Open Captures Folder' 525 402 150 42; $form.Controls.Add($btnAll)
$btnMerge = New-Button 'Merge HARs' 685 402 155 42; $form.Controls.Add($btnMerge)

$btnRecover = New-Button 'Recover HAR from Journal' 20 454 200 34; $form.Controls.Add($btnRecover)
$btnPackage = New-Button 'Package for ChatGPT' 230 454 180 34; $form.Controls.Add($btnPackage)

$lblStatusCaption = New-Label 'Status:' 20 508 55; $form.Controls.Add($lblStatusCaption)
$lblStatus = New-Label 'Idle' 78 508 750 24; $lblStatus.Font = New-Object System.Drawing.Font('Segoe UI Semibold',9); $form.Controls.Add($lblStatus)
$lblSession = New-Label 'Latest session: none' 20 534 810 24; $form.Controls.Add($lblSession)
$lblFiles = New-Label 'HAR segments: 0' 20 560 810 24; $form.Controls.Add($lblFiles)
$lblSize = New-Label 'Capture size: 0 MiB / 450 MiB' 20 586 810 22; $form.Controls.Add($lblSize)
$progressSize = New-Object System.Windows.Forms.ProgressBar
$progressSize.Location = New-Object System.Drawing.Point(20,610); $progressSize.Size = New-Object System.Drawing.Size(820,18)
$progressSize.Minimum = 0; $progressSize.Maximum = 1000; $progressSize.Value = 0
$form.Controls.Add($progressSize)

$form.Controls.Add((New-Label 'Capture log' 20 642 120 22))
$txtLog = New-Object System.Windows.Forms.TextBox
$txtLog.Location = New-Object System.Drawing.Point(20,665); $txtLog.Size = New-Object System.Drawing.Size(820,105)
$txtLog.Multiline = $true; $txtLog.ReadOnly = $true; $txtLog.ScrollBars = 'Vertical'; $txtLog.Font = New-Object System.Drawing.Font('Consolas',8.5)
$form.Controls.Add($txtLog)

$btnBrowseBrave.Add_Click({ Browse-ForFile $txtBrave 'Executable (*.exe)|*.exe|All files (*.*)|*.*' })
$btnBrowseExtension.Add_Click({ Browse-ForFolder $txtExtension })
$btnBrowseProfile.Add_Click({ Browse-ForFolder $txtProfile })
$btnStart.Add_Click({ Start-Capture })
$btnStop.Add_Click({ Request-CleanStop })
$btnLatest.Add_Click({ Open-CaptureFolder })
$btnAll.Add_Click({ Open-AllCaptures })
$btnMerge.Add_Click({ Merge-LatestCapture })
$btnRecover.Add_Click({ Recover-LatestJournal })
$btnPackage.Add_Click({ Package-LatestForChatGPT })

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1000
$timer.Add_Tick({
    try {
        $state = Read-State
        $alive = $false
        if ($null -ne $state) { $alive = Test-PidAlive $state.pid }

        if ($alive -and $state.status -in @('initializing','starting','running','stopping','packaging')) {
            $lblStatus.Text = "$(($state.status).ToString().ToUpper()) - PID $($state.pid)"
            $lblStatus.ForeColor = $(if ($state.status -eq 'running') { [System.Drawing.Color]::DarkGreen } else { [System.Drawing.Color]::DarkOrange })
            $btnStart.Enabled = $false
            $btnStop.Enabled = ($state.status -notin @('stopping','packaging'))
        } else {
            if ($null -ne $state -and $state.status -eq 'stopped') {
                $lblStatus.Text = "Stopped cleanly - $($state.stopReason)"
                $lblStatus.ForeColor = [System.Drawing.Color]::DarkGreen
            } elseif ($null -ne $state -and $state.status -eq 'error') {
                $lblStatus.Text = "Error - $($state.error)"
                $lblStatus.ForeColor = [System.Drawing.Color]::Firebrick
            } elseif ($null -ne $state -and $state.status -in @('initializing','starting','running','stopping','packaging') -and -not $alive) {
                $lblStatus.Text = 'Capture process is no longer running (unexpected exit or hard close). Recovery files may still be usable.'
                $lblStatus.ForeColor = [System.Drawing.Color]::Firebrick
            } else {
                $lblStatus.Text = 'Idle'
                $lblStatus.ForeColor = [System.Drawing.Color]::DimGray
            }
            $btnStart.Enabled = $true
            $btnStop.Enabled = $false
        }

        $dir = Get-LatestCaptureDir
        if ($null -ne $dir) {
            $lblSession.Text = "Latest session: $dir"
            $count = @(Get-ChildItem -LiteralPath $dir -Filter 'traffic-*.har' -File -ErrorAction SilentlyContinue).Count
            $merged = Test-Path -LiteralPath (Join-Path $dir 'merged.har')
            $recovered = Test-Path -LiteralPath (Join-Path $dir 'recovered.har')
            $uploadDir = Get-UploadDirForCapture $dir
            $zipCount = 0
            if (Test-Path -LiteralPath $uploadDir) { $zipCount = @(Get-ChildItem -LiteralPath $uploadDir -Filter '*.zip' -File -ErrorAction SilentlyContinue).Count }
            $lblFiles.Text = "HAR segments: $count    merged.har: $merged    recovered.har: $recovered    ChatGPT ZIP parts: $zipCount"

            $captureBytes = 0
            $budgetMb = [int]$numBudget.Value
            if ($alive -and $null -ne $state -and $state.captureDir -eq $dir -and $null -ne $state.captureBytes) {
                $captureBytes = [double]$state.captureBytes
                if ($null -ne $state.captureBudgetMb) { $budgetMb = [int]$state.captureBudgetMb }
            } else {
                try { $captureBytes = (Get-ChildItem -LiteralPath $dir -File -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum } catch {}
            }
            $captureMb = [Math]::Round(($captureBytes / 1MB), 2)
            $percent = 0
            if ($budgetMb -gt 0) { $percent = [Math]::Min(100, (($captureMb / $budgetMb) * 100)) }
            $lblSize.Text = "Capture size: $captureMb MiB / $budgetMb MiB  ($([Math]::Round($percent,1))%)"
            $progressSize.Value = [Math]::Max(0, [Math]::Min(1000, [int]($percent * 10)))
            $btnPackage.Enabled = -not $alive
        } else {
            $lblSession.Text = 'Latest session: none'
            $lblFiles.Text = 'HAR segments: 0'
            $lblSize.Text = "Capture size: 0 MiB / $([int]$numBudget.Value) MiB"
            $progressSize.Value = 0
            $btnPackage.Enabled = $false
        }

        if (Test-Path -LiteralPath $LogPath) {
            $lines = @(Get-Content -LiteralPath $LogPath -Tail 35 -ErrorAction SilentlyContinue)
            $txtLog.Text = ($lines -join [Environment]::NewLine)
            $txtLog.SelectionStart = $txtLog.TextLength
            $txtLog.ScrollToCaret()
        }
    } catch {}
})
$timer.Start()

$form.Add_FormClosing({
    param($sender, $e)
    try { Save-Settings } catch {}
    $state = Read-State
    if ($null -ne $state -and (Test-PidAlive $state.pid) -and $state.status -in @('initializing','starting','running','stopping','packaging')) {
        $choice = [System.Windows.Forms.MessageBox]::Show(
            "A capture is still running.`r`n`r`nYes = request a clean stop, then close this GUI.`r`nNo = leave capture running invisibly and close only the GUI.`r`nCancel = keep this GUI open.",
            'Capture is running',
            'YesNoCancel',
            'Question'
        )
        if ($choice -eq 'Cancel') { $e.Cancel = $true; return }
        if ($choice -eq 'Yes') {
            try { [System.IO.File]::WriteAllText($StopRequestPath, [DateTime]::UtcNow.ToString('o')) } catch {}
        }
    }
})

# Populate status immediately, then show the GUI.
$timer.Stop(); $timer.Start()
[void]$form.ShowDialog()
$timer.Stop()
