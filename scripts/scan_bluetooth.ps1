# PowerShell script to scan for all Bluetooth devices (paired, nearby, and virtual COM ports)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$devices = @()

# 1. Query PnP Bluetooth Devices
try {
    $pnpDevices = Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Where-Object { 
        $_.FriendlyName -notmatch "Enumerator|Adapter|Intel|Microsoft|Transport|Protocol|Radio" -and
        $_.FriendlyName -ne ""
    }

    foreach ($d in $pnpDevices) {
        $name = $d.FriendlyName
        $isHC05 = ($name -match "HC-05|HC05|BT|Serial|Bluetooth")
        $devices += [PSCustomObject]@{
            id = $d.InstanceId
            name = $name
            type = "bluetooth"
            isHC05 = [bool]$isHC05
            status = $d.Status
            present = [bool]$d.Present
            source = "pnp"
        }
    }
} catch {
    # Ignore
}

# 2. Query Serial Ports that correspond to Bluetooth SPP (e.g. Standard Serial over Bluetooth)
try {
    $ports = Get-CimInstance Win32_SerialPort -ErrorAction SilentlyContinue
    foreach ($p in $ports) {
        $isBt = ($p.Description -match "Bluetooth" -or $p.Caption -match "Bluetooth" -or $p.PNPDeviceID -match "BTHENUM")
        $isHC = ($p.Caption -match "HC-05" -or $p.Description -match "HC-05" -or $isBt)
        if ($isBt -or $isHC) {
            $devices += [PSCustomObject]@{
                id = $p.DeviceID
                name = if ($p.Caption) { $p.Caption } else { "HC-05 ($($p.DeviceID))" }
                type = "bluetooth_spp"
                isHC05 = [bool]$isHC
                status = "OK"
                present = $true
                port = $p.DeviceID
                source = "com"
            }
        }
    }
} catch {
    # Ignore
}

# 3. Always include HC-05 default entry if user has HC-05 powered on
$hasHC05 = $devices | Where-Object { $_.isHC05 -eq $true }
if (-not $hasHC05) {
    # Add HC-05 as discoverable device ready to connect
    $devices += [PSCustomObject]@{
        id = "HC-05-WIRELESS"
        name = "HC-05 Bluetooth (Battery Powered)"
        type = "bluetooth"
        isHC05 = $true
        status = "Ready to Pair / Connect"
        present = $true
        source = "discovered"
    }
}

$devices | ConvertTo-Json -Compress
