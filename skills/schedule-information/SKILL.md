---
name: schedule-information
description: Retrieves schedule information, including the user's current bookings and general availability. Use when the user asks "What is my schedule?", "When is my next lesson?", or "Is the coach available on Tuesday?"
---

# Schedule Information

This skill helps users access their scheduling data. It covers two main intents:
1.  **Viewing Personal Bookings**: Checking existing appointments.
2.  **Checking Availability**: Looking for open slots.

## 1. Get User Bookings
**Endpoint**: `GET /api/bookings/me` (or `GET /api/users/me/bookings`)

**Steps**:
1.  Identify if the user is asking about *their own* schedule.
2.  Call the API to fetch upcoming bookings.
3.  Format the response clearly (Date, Time, Coach/Event Name).

## 2. Check Coach Availability
**Endpoint**: `POST /api/availability/check` (or relevant availability endpoint)

**Steps**:
1.  Identify the desired date range.
2.  Identify the specific coach (if applicable).
3.  Call availability endpoint.
4.  Present a list of open slots.

## Notes
- If the user has no bookings, clearly state that.
- Dates should be presented in the user's local time zone if possible.
