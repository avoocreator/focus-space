# Generate ikon PNG FocusSpace (ring fokus bergaya cozy)
Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size, [string]$path, [bool]$maskable) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  # latar gradient peach -> orange
  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $c1 = [System.Drawing.Color]::FromArgb(255, 250, 200, 140)
  $c2 = [System.Drawing.Color]::FromArgb(255, 244, 132, 95)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45.0)

  if ($maskable) {
    # maskable: full bleed background
    $g.FillRectangle($brush, $rect)
    $scale = 0.62
  } else {
    # rounded square dengan border coklat tebal
    $radius = [int]($size * 0.22)
    $pathObj = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $pathObj.AddArc($size - $d - 1, 1, $d, $d, 270, 90)
    $pathObj.AddArc($size - $d - 1, $size - $d - 1, $d, $d, 0, 90)
    $pathObj.AddArc(1, $size - $d - 1, $d, $d, 90, 90)
    $pathObj.AddArc(1, 1, $d, $d, 180, 90)
    $pathObj.CloseFigure()
    $g.FillPath($brush, $pathObj)

    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 45, 26, 14), [Math]::Max(3, $size * 0.028))
    $g.DrawPath($borderPen, $pathObj)
    $scale = 0.72
  }

  # ring fokus di tengah
  $brown = [System.Drawing.Color]::FromArgb(255, 45, 26, 14)
  $cream = [System.Drawing.Color]::FromArgb(255, 255, 251, 242)
  $cx = $size / 2.0

  $ringR = $size * $scale * 0.5
  $ringPen = New-Object System.Drawing.Pen($brown, [Math]::Max(4, $size * 0.055))
  $ringPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $ringPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  # busur 300 derajat (ada celah, kesan bergerak)
  $g.DrawArc($ringPen, ($cx - $ringR), ($cx - $ringR), $ringR * 2, $ringR * 2, -90, 300)

  # titik tengah
  $dotR = $size * 0.075
  $dotBrush = New-Object System.Drawing.SolidBrush($brown)
  $g.FillEllipse($dotBrush, ($cx - $dotR), ($cx - $dotR), $dotR * 2, $dotR * 2)

  # kilau kecil (bintang) di kanan atas
  $glintBrush = New-Object System.Drawing.SolidBrush($cream)
  $glintR = $size * 0.035
  $gx = $cx + $ringR * 0.95
  $gy = $cx - $ringR * 0.75
  $g.FillEllipse($glintBrush, ($gx - $glintR), ($gy - $glintR), $glintR * 2, $glintR * 2)

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "OK $path"
}

$dir = "C:\Users\kira\Projects\Fecora-Z\public\icons"
if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

New-Icon 192 "$dir\icon-192.png" $false
New-Icon 512 "$dir\icon-512.png" $false
New-Icon 512 "$dir\icon-maskable-512.png" $true
New-Icon 180 "$dir\icon-180.png" $false
