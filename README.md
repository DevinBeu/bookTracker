# Book Tracker App

The Book Tracker App is a web application built using Express, Pug, and PostgreSQL. It allows users to manage their book collections, including creating, editing, and deleting collections, as well as adding and removing books from these collections. It also allows them to manage individual books.

## Requirements

- Express.js
- Node.js
- PostgreSQL

## Installation

1. Download the zip file
2. Install dependencies: `npm install`
3. Create PostgreSQL database named booktracker. From terminal run this command to create tables. `psql -d booktracker -f schema.sql`
   To add sample data for users table run this command from terminal `psql -d booktracker < ./lib/users.sql`.
   To add sample data for books and collections tables run this command from terminal `psql -d booktracker < ./lib/seed-data.sql`.

4.The password for all provided users is 1234.

5. Run the application: `npm start`

## Notes

- App was mainly tested in the Brave browser
- The version of Node used was v18.16.1
- The version of npm used is 9.7.2
- psql (PostgreSQL) version 12.16 (Ubuntu 12.16-0ubuntu0.20.04.1) was used for relational database

## Features

- User authentication for secure access to book management.
- CRUD operations for both book collections and individual books.
- Pagination for efficient data display.
- Use of flash messages to display relevant messages to users.
- Input validation and error handling.
- Password encryption for user authentication security.
- Consistent sorting for all books and collections.

## Usage

1. Navigate to the sign-in page and log in.
2. Explore and manage your book collections on the dashboard.
3. Add, edit, and delete collections or individual books.
4. Deleting a collection doesn't delete the books, it just removes the book from the collection.
5. Deleting a book is accomplished from the myBooks page.

## Author

Devin
