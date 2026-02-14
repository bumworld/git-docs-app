# Users Endpoint (v2)

## Improvements from v1

- Pagination support
- Filtering by status/role
- Batch operations

## GET /api/v2/users

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |
| status | string | Filter by status |
| role | string | Filter by role |
