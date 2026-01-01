# Poytz Operations Guide

Quick reference for day-to-day Poytz operations.

## API Key

```bash
cat ~/.poytz-api-key
# poytz_cce20a6e877535e2b8d1253de5f4f3f0c79d64d09f390a49
```

## Common Operations

### List all routes
```bash
curl https://khamel.com/api/routes -H "X-API-Key: $(cat ~/.poytz-api-key)"
```

### Add a route
```bash
curl -X POST https://khamel.com/api/routes \
  -H "X-API-Key: $(cat ~/.poytz-api-key)" \
  -H "Content-Type: application/json" \
  -d '{"path": "myservice", "target": "https://homelab.deer-panga.ts.net/myservice/"}'
```

### Delete a route
```bash
curl -X DELETE https://khamel.com/api/routes/myservice \
  -H "X-API-Key: $(cat ~/.poytz-api-key)"
```

### Clipboard sync
```bash
# Copy
echo "text to copy" | curl -X POST https://khamel.com/clip -H "X-API-Key: $(cat ~/.poytz-api-key)" -d @-

# Paste
curl https://khamel.com/clip -H "X-API-Key: $(cat ~/.poytz-api-key)"
```

### Create paste/share
```bash
echo "share this" | curl -X POST https://khamel.com/paste -d @-
# Returns: https://khamel.com/p/abc123
```

### Check status
```bash
curl https://khamel.com/status
```

## Deployment

```bash
cd ~/github/poytz
npx wrangler deploy
```

## View logs

```bash
npx wrangler tail
```

## Tailscale Funnel

```bash
# Check status
tailscale funnel status

# Restart funnel
sudo tailscale funnel --bg --https=443 http://localhost:8443

# Disable
sudo tailscale funnel --https=443 off
```

## funnel-proxy

```bash
# Check health
curl http://localhost:8443/health

# View logs
docker logs funnel-proxy --tail 50

# Reload config (after nginx.conf changes)
docker exec funnel-proxy nginx -s reload

# Restart
docker restart funnel-proxy
```

## Adding a New Service

1. **Add to nginx.conf**
   ```nginx
   location /myservice/ {
       set $backend "myservice:8080";
       proxy_pass http://$backend/;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
   }
   ```

2. **Reload nginx**
   ```bash
   docker exec funnel-proxy nginx -s reload
   ```

3. **Add Poytz route**
   ```bash
   curl -X POST https://khamel.com/api/routes \
     -H "X-API-Key: $(cat ~/.poytz-api-key)" \
     -H "Content-Type: application/json" \
     -d '{"path": "myservice", "target": "https://homelab.deer-panga.ts.net/myservice/"}'
   ```

4. **Test**
   ```bash
   curl -L https://khamel.com/myservice
   ```

## Troubleshooting

### Service returns 502
```bash
# Check if container is on correct network
docker inspect myservice --format '{{range $net, $_ := .NetworkSettings.Networks}}{{$net}} {{end}}'
# Should include: homelab_homelab

# Check nginx logs
docker logs funnel-proxy --tail 20
```

### Poytz returns 404
```bash
# Check if route exists
curl https://khamel.com/api/routes -H "X-API-Key: $(cat ~/.poytz-api-key)" | jq '.routes[] | select(.path=="myservice")'
```

### Tailscale Funnel not working
```bash
# Check status
tailscale funnel status

# Re-enable
sudo tailscale funnel --bg --https=443 http://localhost:8443
```

## Current Routes (26 total)

| Path | Service |
|------|---------|
| /jellyfin | Jellyfin |
| /photos | Immich |
| /recipes | Mealie |
| /request | Jellyseerr |
| /sonarr | Sonarr |
| /radarr | Radarr |
| /bazarr | Bazarr |
| /prowlarr | Prowlarr |
| /lidarr | Lidarr |
| /books | Calibre-Web |
| /audiobooks | Audiobookshelf |
| /docs | Paperless-NGX |
| /pantry | Grocy |
| /files | Filebrowser |
| /workflows | N8N |
| /tools | IT-Tools |
| /code | Code-Server |
| /portainer | Portainer |
| /home | Homepage |
| /uptime | Uptime Kuma |
| /logs | Dozzle |
| /disks | Scrutiny |
| /backup | Duplicati |
| /notify | Apprise |
| /assistant | Home Assistant |
| /pihole | Pi-hole Admin |
