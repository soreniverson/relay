# Relay Runbooks

Operational procedures for common scenarios.

## Incident Response

### High CPU on API Server

**Symptoms:**

- API latency > 500ms
- CPU utilization > 80%

**Investigation:**

```bash
# Check current connections
redis-cli INFO clients

# Check slow queries
psql -c "SELECT * FROM pg_stat_activity WHERE state = 'active' ORDER BY query_start;"

# Check API logs
kubectl logs -l app=relay-api --tail=100
```

**Resolution:**

1. Scale API replicas: `kubectl scale deployment relay-api --replicas=5`
2. If DB-related, add read replica or optimize query
3. If Redis-related, check for hot keys

### Database Connection Pool Exhausted

**Symptoms:**

- "Connection pool exhausted" errors
- Requests timing out

**Investigation:**

```bash
# Check active connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='relay';"

# Check connection states
psql -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"
```

**Resolution:**

1. Kill idle connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';`
2. Increase pool size in Prisma config
3. Check for connection leaks in application code

### Redis Memory Full

**Symptoms:**

- "OOM" errors in Redis
- Cache misses increasing

**Investigation:**

```bash
# Check memory usage
redis-cli INFO memory

# Find large keys
redis-cli --bigkeys

# Check memory by type
redis-cli MEMORY DOCTOR
```

**Resolution:**

1. Flush expired keys: `redis-cli --scan --pattern 'cache:*' | xargs redis-cli DEL`
2. Reduce TTL on session cache
3. Scale Redis cluster or increase memory

### Replay Processing Backlog

**Symptoms:**

- Replays stuck in "processing" status
- Worker queue depth increasing

**Investigation:**

```bash
# Check queue depth
redis-cli LLEN bull:replay-process:wait

# Check failed jobs
redis-cli LLEN bull:replay-process:failed

# Check worker logs
kubectl logs -l app=relay-worker --tail=100
```

**Resolution:**

1. Scale workers: `kubectl scale deployment relay-worker --replicas=5`
2. Check for failed jobs and retry: Worker UI at `/admin/queues`
3. Check S3 access (upload/download errors)

## Deployment

### Rolling Back a Deployment

```bash
# Kubernetes
kubectl rollout undo deployment/relay-api

# Check rollout status
kubectl rollout status deployment/relay-api

# Rollback to specific revision
kubectl rollout undo deployment/relay-api --to-revision=2
```

### Database Migration Rollback

```bash
# List migrations
npx prisma migrate status

# Rollback last migration (manual SQL)
psql -f migrations/rollback/20240101_migration_name.sql

# Mark migration as rolled back
npx prisma migrate resolve --rolled-back 20240101_migration_name
```

### Emergency Feature Flag

Disable a feature without deployment:

```bash
# Via API
curl -X POST https://api.relay.dev/admin/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"flag": "replays_enabled", "enabled": false}'

# Via database
psql -c "UPDATE feature_flags SET enabled = false WHERE flag = 'replays_enabled';"
```

## Maintenance

### Scheduled Maintenance Window

1. **Notify Users** (24h before)
   - Post status page update
   - Send email notification

2. **Pre-Maintenance**
   - Enable maintenance mode: `kubectl apply -f k8s/maintenance-mode.yaml`
   - Drain connections gracefully

3. **During Maintenance**
   - Perform updates/migrations
   - Run health checks

4. **Post-Maintenance**
   - Disable maintenance mode
   - Verify all services healthy
   - Update status page

### Database Maintenance

```bash
# Vacuum and analyze
psql -c "VACUUM ANALYZE;"

# Reindex
psql -c "REINDEX DATABASE relay;"

# Check table bloat
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Log Rotation

Logs are rotated automatically, but manual rotation:

```bash
# Force log rotation
kubectl exec -it relay-api-pod -- kill -USR1 1

# Archive old logs
aws s3 cp /var/log/relay/ s3://relay-logs-archive/ --recursive
```

## Monitoring

### Key Metrics to Watch

| Metric          | Warning | Critical |
| --------------- | ------- | -------- |
| API Latency p99 | > 500ms | > 2000ms |
| Error Rate      | > 1%    | > 5%     |
| CPU Usage       | > 70%   | > 90%    |
| Memory Usage    | > 80%   | > 95%    |
| DB Connections  | > 80%   | > 95%    |
| Queue Depth     | > 1000  | > 10000  |

### Alerting Rules

```yaml
# Prometheus alerting rules
groups:
  - name: relay
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: HighLatency
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
```

### Dashboard Queries

**Request Rate:**

```promql
sum(rate(http_requests_total[5m])) by (endpoint)
```

**Error Rate:**

```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
```

**P99 Latency:**

```promql
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint))
```

## Security Incidents

### Suspected API Key Compromise

1. **Immediately revoke the key:**

   ```bash
   curl -X DELETE https://api.relay.dev/admin/api-keys/key_id \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

2. **Audit recent activity:**

   ```sql
   SELECT * FROM audit_logs
   WHERE api_key_id = 'key_id'
   ORDER BY created_at DESC
   LIMIT 100;
   ```

3. **Notify affected project owner**

4. **Generate new key for customer**

### Data Breach Response

1. **Contain**: Isolate affected systems
2. **Assess**: Determine scope of breach
3. **Notify**: Alert security team, legal, affected users
4. **Remediate**: Fix vulnerability, rotate credentials
5. **Document**: Create incident report
6. **Review**: Post-incident review and improvements

## Disaster Recovery

### Full Region Failure

1. **Verify failure** via health checks
2. **Update DNS** to route traffic away
3. **Communicate** status to users
4. **Restore** from backup if needed
5. **Failback** when region recovers

### Database Restore

```bash
# List available backups
aws rds describe-db-cluster-snapshots --db-cluster-identifier relay-us-west

# Restore from snapshot
aws rds restore-db-cluster-from-snapshot \
  --db-cluster-identifier relay-us-west-restored \
  --snapshot-identifier snap-2024-01-25

# Point-in-time recovery
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier relay-us-west \
  --db-cluster-identifier relay-us-west-restored \
  --restore-to-time 2024-01-25T10:00:00Z
```

### S3 Recovery

```bash
# List object versions
aws s3api list-object-versions --bucket relay-us-west-media --prefix uploads/

# Restore deleted object
aws s3api copy-object \
  --bucket relay-us-west-media \
  --copy-source relay-us-west-media/uploads/file.jpg?versionId=xxx \
  --key uploads/file.jpg
```
