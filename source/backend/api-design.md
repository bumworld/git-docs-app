---
title: REST API Design Guide
sidebar:
  label: API Design
---

# REST API Design Guide

## API Design Principles

### RESTful Conventions

Follow standard REST conventions for resource-based APIs.

| HTTP Method | Action | Example |
|-------------|--------|---------|
| GET | Retrieve resource(s) | `GET /api/users` |
| POST | Create resource | `POST /api/users` |
| PUT | Replace resource | `PUT /api/users/123` |
| PATCH | Update resource | `PATCH /api/users/123` |
| DELETE | Delete resource | `DELETE /api/users/123` |

---

## URL Structure

### Resource Naming

Use plural nouns for collections, singular identifiers.

```
✅ Good
GET    /api/users              # List all users
GET    /api/users/123          # Get specific user
POST   /api/users              # Create user
PUT    /api/users/123          # Replace user
PATCH  /api/users/123          # Update user
DELETE /api/users/123          # Delete user

❌ Bad
GET    /api/getUsers
POST   /api/createUser
GET    /api/user/123/get
```

### Nested Resources

Limit nesting to 2 levels for clarity.

```
✅ Good
GET /api/users/123/posts           # User's posts
GET /api/posts?userId=123          # Alternative

❌ Bad (too deep)
GET /api/users/123/posts/456/comments/789/replies
```

---

## Request/Response Format

### Request Body (POST/PUT/PATCH)

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "age": 30
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "123",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "createdAt": "2024-02-18T00:00:00Z"
  },
  "meta": {
    "timestamp": "2024-02-18T00:00:00Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-02-18T00:00:00Z"
  }
}
```

---

## Status Codes

Use appropriate HTTP status codes.

| Code | Meaning | Use Case |
|------|---------|----------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource conflict (duplicate) |
| 422 | Unprocessable Entity | Validation failed |
| 500 | Internal Server Error | Server error |

---

## Pagination

### Query Parameters

```
GET /api/users?page=2&limit=20&sort=-createdAt&filter=active
```

### Response with Pagination

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  }
}
```

---

## Authentication

### Bearer Token

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### API Key

```http
X-API-Key: your-api-key-here
```

---

## Versioning

### URL Versioning (Recommended)

```
/api/v1/users
/api/v2/users
```

### Header Versioning (Alternative)

```http
Accept: application/vnd.myapi.v1+json
```

---

## Rate Limiting

### Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1519862400
```

### Response (429 Too Many Requests)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 60
  }
}
```

---

## Filtering, Sorting, Search

### Query Parameters

```
# Filtering
GET /api/users?status=active&role=admin

# Sorting (- for descending)
GET /api/users?sort=-createdAt,name

# Search
GET /api/users?search=john

# Combining
GET /api/users?status=active&sort=-createdAt&search=john&page=1&limit=20
```

---

## API Documentation

Use OpenAPI (Swagger) specification.

```yaml
openapi: 3.0.0
info:
  title: My API
  version: 1.0.0
paths:
  /api/users:
    get:
      summary: List users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
```

---

## Security Best Practices

1. **Always use HTTPS** in production
2. **Validate input** on every request
3. **Sanitize output** to prevent XSS
4. **Use parameterized queries** to prevent SQL injection
5. **Implement rate limiting** to prevent abuse
6. **Log security events** for auditing
7. **Never expose sensitive data** in responses
8. **Use CORS properly** to restrict origins
