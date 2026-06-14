# ShopKit — Full-Stack E-commerce

Vite + React frontend, Node.js/Express backend, PostgreSQL database.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vite, React 18, React Router 6 |
| Backend | Node.js, Express 4 |
| Database | PostgreSQL (via `pg`) |
| Auth | JWT + bcrypt |

## Project layout

```
ecommerce/
├── client/               # Vite React app
│   └── src/
│       ├── api/          # Typed API client
│       ├── components/   # Navbar, ProductCard
│       ├── hooks/        # useAuth, useCart (React context)
│       └── pages/        # Home, Products, Cart, Orders, Admin …
└── server/               # Express API
    └── src/
        ├── db/           # pool.js, migrate.js, seed.js
        ├── middleware/   # auth.js (JWT)
        └── routes/       # auth, products, cart, orders
```

## Quick start

### 1. Prerequisites

- Node 20+
- PostgreSQL running locally (or a connection string)

### 2. Clone & install

```bash
git clone <repo>
cd ecommerce
npm install          # installs root + all workspaces
```

### 3. Configure environment

```bash
cp server/.env.example server/.env
# edit server/.env — set DATABASE_URL and JWT_SECRET
```

### 4. Database setup

```bash
npm run db:migrate   # creates tables
npm run db:seed      # loads sample products + users
```

Seed credentials:
- `admin@example.com` / `admin123`
- `customer@example.com` / `customer123`

### 5. Run dev servers

```bash
npm run dev          # starts both client (:5173) and server (:3000)
```

Open http://localhost:5173

## API reference

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register |
| POST | `/api/auth/login` | — | Login → JWT |
| GET | `/api/auth/me` | Bearer | Current user |

### Products
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/products` | — | List (filter: `q`, `category`, `page`, `limit`) |
| GET | `/api/products/categories` | — | Category list |
| GET | `/api/products/:id` | — | Single product |
| POST | `/api/products` | Admin | Create |
| PATCH | `/api/products/:id` | Admin | Update |
| DELETE | `/api/products/:id` | Admin | Delete |

### Cart
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cart` | Bearer | Get cart |
| PUT | `/api/cart` | Bearer | Add/update item `{ product_id, quantity }` |
| DELETE | `/api/cart/:product_id` | Bearer | Remove item |
| DELETE | `/api/cart` | Bearer | Clear cart |

### Orders
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/orders` | Bearer | Checkout (cart → order) |
| GET | `/api/orders` | Bearer | My orders (admin: all) |
| GET | `/api/orders/:id` | Bearer | Order detail |
| PATCH | `/api/orders/:id/status` | Admin | Update status |

## Docker (local / CI)

```bash
# Build images
docker build -t shopkit-server ./server
docker build -t shopkit-client ./client

# Or spin everything up with Compose
docker compose up --build
```

`docker-compose.yml` starts postgres, server (:3000), and client (:5173) with one command. Good for local testing before pushing to Kubernetes.

---

## Kubernetes

```
k8s/
├── base/
│   ├── namespace.yaml    # shopkit namespace
│   ├── secrets.yaml      # postgres + jwt secrets (replace values!)
│   ├── postgres.yaml     # StatefulSet + headless Service + PVC
│   ├── server.yaml       # Deployment (2 replicas) + Service + migrate Job
│   ├── client.yaml       # Deployment (2 replicas) + Service
│   ├── ingress.yaml      # nginx Ingress + TLS via cert-manager
│   ├── hpa.yaml          # HPA: server scales 2→10, client 2→6
│   └── kustomization.yaml
└── overlays/
    ├── dev/              # 1 replica, local image tags
    └── prod/             # pinned SHA image tags
```

### Prerequisites

```bash
# nginx ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml

# cert-manager (TLS)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.15.0/cert-manager.yaml
```

### Secrets

Edit `k8s/base/secrets.yaml` or create secrets imperatively (preferred — never commit real values):

```bash
# Postgres credentials
kubectl create secret generic postgres-secret -n shopkit \
  --from-literal=username=postgres \
  --from-literal=password=<strong-password>

# App secrets
kubectl create secret generic server-secret -n shopkit \
  --from-literal=jwt-secret=<long-random-string> \
  --from-literal=database-url=postgresql://postgres:<password>@postgres:5432/ecommerce
```

### Deploy

```bash
# Dev (minikube / kind)
kustomize build k8s/overlays/dev | kubectl apply -f -

# Production
kustomize build k8s/overlays/prod | kubectl apply -f -

# Watch rollout
kubectl rollout status deployment/server -n shopkit
kubectl rollout status deployment/client -n shopkit
```

### Migrate & seed

```bash
# Run migration job (creates tables)
kubectl create job db-migrate-manual --from=job/db-migrate -n shopkit

# One-off seed pod
kubectl run db-seed -n shopkit --rm -it --restart=Never \
  --image=ghcr.io/YOUR_ORG/shopkit-server:latest \
  --env="DATABASE_URL=$(kubectl get secret server-secret -n shopkit -o jsonpath='{.data.database-url}' | base64 -d)" \
  -- node src/db/seed.js
```

### CI/CD

`.github/workflows/ci.yml` handles the full pipeline on every push to `main`:

1. Builds and pushes Docker images to GHCR (tagged with the commit SHA)
2. Updates the prod kustomize overlay with the new tags
3. Applies manifests and waits for rollouts to complete

**Required GitHub secrets:**

| Secret | Value |
|--------|-------|
| `KUBECONFIG` | base64-encoded kubeconfig for your cluster |

### Update domain

Replace `shop.example.com` in `k8s/base/ingress.yaml` with your actual domain before deploying.

---

## Production build (static only)

```bash
npm run build        # builds client to client/dist/
```
