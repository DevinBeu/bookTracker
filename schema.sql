CREATE TABLE users (
  username text PRIMARY KEY,
  password text NOT NULL
);

CREATE TABLE collections (
  id SERIAL PRIMARY KEY,
  user_username text REFERENCES users(username) ON DELETE CASCADE,
  collection_name VARCHAR(255)
);

CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  collection_id INT REFERENCES collections(id) ON DELETE SET NULL,
  title VARCHAR(255),
  author VARCHAR(255),
  user_username text REFERENCES users(username) ON DELETE CASCADE
);

