Add-Type -AssemblyName System.Drawing
$soleIconDir = Join-Path $PSScriptRoot '..\public\icons'
New-Item -ItemType Directory -Path $soleIconDir -Force | Out-Null
foreach ($soleSize in @(192,512)) {
    $soleBitmap = [System.Drawing.Bitmap]::new($soleSize,$soleSize)
    $soleGraphics = [System.Drawing.Graphics]::FromImage($soleBitmap)
    $soleGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $soleGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#155b48'))
    $soleScale = $soleSize / 192.0
    $soleGraphics.ScaleTransform($soleScale,$soleScale)
    $solePen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#d6e88b'),7)
    $solePath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $solePath.AddLines([System.Drawing.PointF[]]@([System.Drawing.PointF]::new(42,70),[System.Drawing.PointF]::new(65,85),[System.Drawing.PointF]::new(88,74),[System.Drawing.PointF]::new(115,106),[System.Drawing.PointF]::new(143,112),[System.Drawing.PointF]::new(153,128),[System.Drawing.PointF]::new(145,140),[System.Drawing.PointF]::new(40,140),[System.Drawing.PointF]::new(35,127),[System.Drawing.PointF]::new(42,70)))
    $soleGraphics.DrawPath($solePen,$solePath)
    $soleGraphics.DrawLine($solePen,38,122,145,122)
    $soleGraphics.DrawLine($solePen,85,93,103,88)
    $soleGraphics.DrawLine($solePen,96,106,114,101)
    $soleBitmap.Save((Join-Path $soleIconDir "icon-$soleSize.png"),[System.Drawing.Imaging.ImageFormat]::Png)
    $solePath.Dispose(); $solePen.Dispose(); $soleGraphics.Dispose(); $soleBitmap.Dispose()
}
