---
name: schedule-training
description: Schedules a new training session, lesson, or court time. Use when the user expresses intent to book something, e.g., "Book a lesson", "Schedule training", "I want to play next week".
---

# Schedule Training

This skill guides the agent through the process of creating a new booking.

## Prerequisites
Before calling the booking API, ensure you have:
1.  **Date & Time**: Specific slot (e.g., "Tuesday at 5 PM").
2.  **Coach/Service**: Who or what is being booked?
3.  **Duration**: (Optional, default to 1 hour if unspecified).

## Workflow

1.  **Clarify Details**: If the user says "Book a lesson", ask "For which day and time?" and "With which coach?".
2.  **Check Availability**: (Optional but recommended) Verify the slot is free using `schedule-information` logic.
3.  **Create Booking**:
    - **Endpoint**: `POST /api/bookings`
    - **Payload**:
      ```json
      {
        "coach_id": "...",
        "start_time": "ISO-8601 string",
        "duration_minutes": 60,
        "notes": "..."
      }
      ```
4.  **Confirm**: Report success or failure to the user.

## Error Handling
- **Slot Taken**: Suggest the nearest available alternative.
- **Coach Unavailable**: Inform the user and ask if they accept a different coach.
