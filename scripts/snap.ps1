# Takes a dated screenshot for the hackathon proof folder (Windows).
# Usage (from the repo folder):
#   powershell -ExecutionPolicy Bypass -File scripts/snap.ps1 plan-mode
#   powershell -ExecutionPolicy Bypass -File scripts/snap.ps1 plan-mode -Delay 5
# Captures the screen the mouse is on, after a countdown so you can bring the CodeBuddy chat into view.
# Saves to proof/_inbox/YYYY-MM-DD_HHMM_<label>.png (gitignored) and opens it so you can check it.
# Only after checking, move it into proof/screenshots/. proof/ will be public: no private chats, email or keys.
# Keep the taskbar clock visible: CodeBuddy's chat list does not show dates.
# Mac: press Cmd+Shift+3 with the menu-bar clock visible, then rename and move the file the same way.
param(
    [Parameter(Position = 0)][string]$Label = "codebuddy",
    [int]$Delay = 3,
    [string]$OutDir,
    [switch]$NoOpen
)

# $PSScriptRoot is empty inside param() defaults in Windows PowerShell 5.1, so the default is set here.
if (-not $OutDir) { $OutDir = Join-Path (Split-Path -Parent $PSScriptRoot) "proof\_inbox" }

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
# Without this, Windows display scaling makes the capture cover only part of the screen.
Add-Type -Namespace Snap -Name Dpi -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();'
[void][Snap.Dpi]::SetProcessDPIAware()

$safeLabel = ($Label -replace '[^A-Za-z0-9_-]', '-').Trim('-')
if (-not $safeLabel) { $safeLabel = "codebuddy" }
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

for ($i = $Delay; $i -gt 0; $i--) { Write-Host "Capturing in $i..."; Start-Sleep -Seconds 1 }

$bounds = [System.Windows.Forms.Screen]::FromPoint([System.Windows.Forms.Cursor]::Position).Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

$path = Join-Path $OutDir ("{0}_{1}.png" -f (Get-Date -Format "yyyy-MM-dd_HHmm"), $safeLabel)
$bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

Write-Host "Saved $path"
Write-Host "Check it shows nothing private, then move it to proof/screenshots/ and type /log-proof in CodeBuddy."
if (-not $NoOpen) { Invoke-Item $path }
