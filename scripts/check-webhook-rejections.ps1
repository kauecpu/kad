$ErrorActionPreference = 'Stop'
# Staging only. Both requests are invalid and contain no real financial resource.
$probeEndpoint = 'https://npaoyezfwmgauirrlyog.supabase.co/functions/v1/mercado-pago-webhook'
$probeCases = @(
    @{ Name = 'invalid_body'; Uri = $probeEndpoint; Body = '{}'; Headers = @{}; Expected = 400 },
    @{
        Name = 'invalid_signature'
        Uri = $probeEndpoint + '?data.id=security-probe'
        Body = (@{ type = 'payment'; live_mode = $true; data = @{ id = 'security-probe' } } | ConvertTo-Json -Compress)
        Headers = @{ 'x-request-id' = 'security-probe'; 'x-signature' = 'ts=1700000000,v1=' + ('0' * 64) }
        Expected = 401
    }
)
foreach ($probe in $probeCases) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $probe.Uri -Body $probe.Body -Headers $probe.Headers -ContentType 'application/json' -TimeoutSec 20
        $status = [int]$response.StatusCode
    } catch {
        if (-not $_.Exception.Response) { throw 'Webhook probe could not reach staging.' }
        $status = [int]$_.Exception.Response.StatusCode
    }
    [pscustomobject]@{ Probe = $probe.Name; Status = $status; Expected = $probe.Expected } | ConvertTo-Json -Compress
    if ($status -ne $probe.Expected) { throw 'Webhook rejection probe failed.' }
}
