$url = "http://localhost:3000/login"

for ($i = 0; $i -lt 120; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200) {
            Start-Process $url
            exit 0
        }
    } catch {
        # השרת עדיין לא מוכן
    }

    Start-Sleep -Seconds 1
}

exit 1
