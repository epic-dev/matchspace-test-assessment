## Project Specification

The Saas platform for music teachers. Teachers can use the platform to represent themselves, show their credentials, stories, instruments they teach playing and their lessons availability as well as the lessons price per hour. Teacher accept payments thru the platform.

### Functional requirements
1. Platform users can register themselves as teachers. They're able to:
    - create a public profile
        - full name
        - instrument(s)
        - short bio
        - credentials or education
        - lesson location or online availability
        - hourly price
    - receive booking requests from students
    - update profile
    - set available lessons time
2. Users should be able to display a list of all teachers
3. Users should be able to display teacher details
4. Users should be able to book a lesson with a certain teacher, providing
    - student name
    - student email
    - requested date/time
    - message (optional)
5. Users should be able to create a payment request
    - successful payment (test mode) should confirm booking request

### Non-functional requirements
It wasn't asked explicitly and I don't think I could fit in the time frame. So, skip it intentionally

### Core entities (data model)
1. Teacher
    - name
    - bio
    - instruments
    - education
    - credentials
    - lessonLocation
    - onlineAvailability
    - hourlyPrice
2. Booking request
    - teacherId
    - dateTime
    - hours (default 1)
    - location
    - isOnline
    - studentName
    - studentEmail
    - message
3. Payment

### API
```bash
GET /v1/teachers       # list of teachers
GET /v1/teachers/{id}  # teacher details
POST /v1/register      # creates teacher's account
PATCH /v1/teachers     # updated teacher's info
    body: {
        name?,
        bio?,
        instruments?,
        education?,
        credentials?,
        onlineAvailability?,
        hourlyPrice?
    }
POST /v1/booking       # creates booking request
    body: {
        teacherId,
        dateTime,
        hours,
        location?,
        isOnline?,
        studentName,
        studentEmail,
        message?,
    }
POST /v1/checkout      # creates a payment intention (Stripe)
    body: {
        mode: 'payment',
        success_url,
        line_items,
    }
```

### Database
As a database I've chosen Supabase because of it has auth management out of the box. No need to implement authentication explicitly

### Infrastructure and backend
Simple repositories, adapters, ports and interfaces. Next.js server actions handle Stripe API calls and database operations

### High-level design schema

### Tech stack

Language: TypeScript
Framework and tools: Next.js latest (App Router), React 19, zod, Stripe client
Database: Supabase
Deployment: Vercel
Alternative deployment: Docker image