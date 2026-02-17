---
title: Kubernetes Deployment Guide
sidebar:
  label: K8s Deployment
---

# Kubernetes Deployment Guide

## Cluster Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Production Cluster                    │
│                                                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │  Namespace │  │  Namespace │  │  Namespace │        │
│  │    prod    │  │   staging  │  │     dev    │        │
│  └────────────┘  └────────────┘  └────────────┘        │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Ingress Controller                  │    │
│  │              (NGINX / Traefik)                   │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│         ┌───────────────┼───────────────┐               │
│         │               │               │               │
│  ┌──────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐       │
│  │   API Pods  │ │   Web Pods  │ │ Worker Pods│       │
│  │  (3 replicas)│ │ (3 replicas)│ │(2 replicas)│       │
│  └──────┬──────┘ └──────┬──────┘ └─────┬──────┘       │
│         │               │               │               │
│  ┌──────▼───────────────▼───────────────▼──────┐       │
│  │              Service Layer                    │       │
│  │        (ClusterIP Services)                   │       │
│  └───────────────────┬───────────────────────────┘      │
│                      │                                   │
│  ┌──────────────────▼────────────────────────────┐     │
│  │            StatefulSets                         │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐    │     │
│  │  │PostgreSQL│  │   Redis  │  │ RabbitMQ │    │     │
│  │  └──────────┘  └──────────┘  └──────────┘    │     │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Deployment Manifests

### API Server Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: prod
  labels:
    app: api-server
    version: v1.2.3
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
        version: v1.2.3
    spec:
      containers:
      - name: api-server
        image: myregistry/api-server:v1.2.3
        ports:
        - containerPort: 8000
          name: http
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: redis-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: api-server
  namespace: prod
spec:
  type: ClusterIP
  selector:
    app: api-server
  ports:
  - port: 80
    targetPort: 8000
    protocol: TCP
```

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-server-hpa
  namespace: prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
```

### Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: prod
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - api.example.com
    secretName: api-tls-cert
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-server
            port:
              number: 80
```

---

## ConfigMaps and Secrets

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: prod
data:
  redis-url: "redis://redis-service:6379"
  log-level: "info"
  feature-flags: |
    {
      "newFeature": true,
      "betaFeature": false
    }
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: database-secret
  namespace: prod
type: Opaque
data:
  # Base64 encoded values
  url: cG9zdGdyZXNxbDovL3VzZXI6cGFzc0BkYi5leGFtcGxlLmNvbTo1NDMyL2RiCg==
  username: dXNlcg==
  password: cGFzc3dvcmQ=
```

---

## StatefulSets

### PostgreSQL StatefulSet

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: prod
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          value: myapp
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: password
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 100Gi
```

---

## Monitoring

### ServiceMonitor (Prometheus)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: api-server-metrics
  namespace: prod
spec:
  selector:
    matchLabels:
      app: api-server
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

### PodDisruptionBudget

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-server-pdb
  namespace: prod
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: api-server
```

---

## Deployment Strategies

### Blue-Green Deployment

```yaml
# Blue (current)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server-blue
  labels:
    version: blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-server
      version: blue
  template:
    metadata:
      labels:
        app: api-server
        version: blue
    spec:
      containers:
      - name: api
        image: myregistry/api:v1.0.0

---
# Green (new)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server-green
  labels:
    version: green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-server
      version: green
  template:
    metadata:
      labels:
        app: api-server
        version: green
    spec:
      containers:
      - name: api
        image: myregistry/api:v2.0.0

---
# Service switches between blue and green
apiVersion: v1
kind: Service
metadata:
  name: api-server
spec:
  selector:
    app: api-server
    version: blue  # Change to 'green' to switch
  ports:
  - port: 80
    targetPort: 8000
```

---

## Useful Commands

```bash
# Deploy application
kubectl apply -f deployment.yaml

# Check deployment status
kubectl rollout status deployment/api-server -n prod

# View logs
kubectl logs -f deployment/api-server -n prod

# Execute command in pod
kubectl exec -it api-server-xxx -n prod -- /bin/bash

# Port forward for local debugging
kubectl port-forward svc/api-server 8000:80 -n prod

# Rollback deployment
kubectl rollout undo deployment/api-server -n prod

# Scale deployment
kubectl scale deployment/api-server --replicas=5 -n prod

# View events
kubectl get events -n prod --sort-by='.lastTimestamp'

# Debug pod issues
kubectl describe pod api-server-xxx -n prod
```
