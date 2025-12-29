---
name: reschedule-training
description: Modifies an existing booking to a new date or time. Use when the user wants to change a scheduled event, e.g., "Reschedule my lesson", "Move my appointment to 3 PM".
---

# Reschedule Training

This skill handles updating existing booking details.

## Workflow

1.  **Identify Booking**:
    - Ask the user *which* booking to move if they have multiple.
    - Retrieve current bookings if necessary to confirm the ID.

2.  **Get New Slot**:
    - Ask "When would you like to move it to?"

3.  **Execute Update**:
    - **Endpoint**: `PUT /api/bookings/{booking_id}` (or `PATCH`)
    - **Payload**:
      ```json
      {
        "start_time": "New ISO-8601 string"
      }
      ```

4.  **Confirm**: Verify the change was successful and state the new time clearly.

## Constraints
- Ensure the new slot is available before confirming.
- Check cancellation/rescheduling policies (e.g., usually 24h notice).
