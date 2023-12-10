-- data for the collections table
INSERT INTO collections (user_username, collection_name)
VALUES
  ('admin', 'Fiction'),
  ('admin', 'Science Fiction'),
  ('developer', 'Mystery'),
  ('developer', 'Non-Fiction');

-- data for the books table

INSERT INTO books (collection_id, title, author, user_username)
VALUES
  -- User: admin
  (1, 'To Kill a Mockingbird', 'Harper Lee', 'admin'),
  (1, '1984', 'George Orwell', 'admin'),
  (1, 'The Great Gatsby', 'F. Scott Fitzgerald', 'admin'),
  (1, 'Dune', 'Frank Herbert', 'admin'),
  (1, 'Foundation', 'Isaac Asimov', 'admin'),
  (1, 'Neuromancer', 'William Gibson', 'admin'),
  (2, 'The Hobbit', 'J.R.R. Tolkien', 'admin'),
  (2, 'Brave New World', 'Aldous Huxley', 'admin'),
  (2, 'The Catcher in the Rye', 'J.D. Salinger', 'admin'),
  (2, 'The Lord of the Rings', 'J.R.R. Tolkien', 'admin'),
  (2, 'Moby-Dick', 'Herman Melville', 'admin'),
  (2, 'The Odyssey', 'Homer', 'admin'),
  (2, 'Frankenstein', 'Mary Shelley', 'admin'),
  -- User: developer
  (3, 'The Girl with the Dragon Tattoo', 'Stieg Larsson', 'developer'),
  (3, 'Gone Girl', 'Gillian Flynn', 'developer'),
  (3, 'Murder on the Orient Express', 'Agatha Christie', 'developer'),
  (3, 'Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', 'developer'),
  (3, 'Educated', 'Tara Westover', 'developer'),
  (3, 'The Immortal Life of Henrietta Lacks', 'Rebecca Skloot', 'developer');
