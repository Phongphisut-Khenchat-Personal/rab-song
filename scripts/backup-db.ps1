$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path "backups" | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
docker exec rab-song-postgres-1 pg_dump -U rabsong -d rabsong -Fc -f /tmp/rabsong.dump
docker cp rab-song-postgres-1:/tmp/rabsong.dump "backups/rabsong-$stamp.dump"
Write-Output "สำรองไว้ที่ backups/rabsong-$stamp.dump"
