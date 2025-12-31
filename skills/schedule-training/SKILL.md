---
name: schedule-training
description: Schedules a new training session, lesson, or court time. Use when the user expresses intent to book something, e.g., "Book a lesson", "Schedule training", "I want to play next week".
---

# Schedule Training

This skill guides the agent through the process of creating a new booking.
by default schedules should start on the hour and last for an hour. If the user/player/parent is booking a lesson for multiple players at the same time (for example, a parent a lesson for their children, preference should be given to schedule the lessons back to back. If the first lesson is not available, the next available time should be used. If the user/player/parent is booking multiple lessons for the same day, the lessons should be scheduled back to back. if the user/player/parent is scheduling lessons for multiple days, the lessons should be scheduled at the same time every day if possible, to the best extent possible. by default, the coach to be schedule is the coach associated with the email box that you are receving the email from.

When doing the scheduling, you should request the coach's and booked times using the coach availabilty times api and the . for the dates that they are booking, you should request the coach's schedule and booked times for each date. If the user/player/parent is asking to schedule a lesson with an indeterminate date, you should schedule the training for the next day that is available. if the user/player/parent is asking to schedule for a specific date and time and it is available, you should schedule the training for that date and time. If the user/player/parent is asking to schedule for a specific date and time and it is not available, you should suggest the next available time and include 2 alternative times in the response.

## Prerequisites

1. Call the api to get the coaches avaialability -- api/coaches/{coach_id}/availability
2. call the api to get the booked times. -- api/bookings

Before creating the booking API, ensure you have:

1.  **Date and time**: Specific slot (e.g., "Tuesday at 5 PM").
2.  **Duration**: (Optional, default to 1 hour if unspecified).

## Workflow

1.  **Clarify Details**: If the user says "Book a lesson", ask "For which day and time?".
2.  **Check Availability**: Verify the slot is free using `schedule-information` logic.
3.  **Create Booking**:
    - **Endpoint**: `POST /api/bookings`
    - **Payload**:
      ```json
      {
        "coach_id": "...",
        "player_id": "...",
        "start_time": "ISO-8601 string",
        "duration_minutes": 60,
        "notes": "..."
      }
      ```
4.  **Confirm**: Report success or failure to the user.

## Error Handling

- **Slot Taken**: Suggest the nearest 2 available alternative, inform the user that the slot is taken and ask if they would like to book a different time. If the user would like to book a different time, repeat the process.
