# Users Endpoint

## GET /api/v1/users

Returns a list of all registered users.

### Response

```json
{
  "users": [
    {
      "id": 1,
      "email": "user@example.com",
      "role": "admin",
      "status": "active"
    }
  ]
}
```

## PUT /api/v1/users/:id

Update user status or role.

### Request Body

```json
{
  "status": "active",
  "role": "user"
}
```
