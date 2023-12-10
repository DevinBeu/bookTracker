const { dbQuery } = require("./db-query");
const bcrypt = require("bcrypt");

module.exports = class PgPersistence {
  constructor(session) {
    this.username = session.username;
  }
  // async function for authentication.. see ToDos project
  async authenticate(username, password) {
    const FIND_HASHED_PASSWORD =
      "SELECT password FROM users" + "  WHERE username = $1";
    let result = await dbQuery(FIND_HASHED_PASSWORD, username);
    if (result.rowCount === 0) return false;

    return bcrypt.compare(password, result.rows[0].password);
  }
  // async function returns the number of total of collections for currently signed in user
  async getTotalCollections() {
    const GET_TOTAL_COLLECTIONS = `
      SELECT COUNT(id) AS total_collections
      FROM collections
      WHERE user_username = $1`;

    const result = await dbQuery(GET_TOTAL_COLLECTIONS, this.username);
    const totalCollections = result.rows[0].total_collections;
    return totalCollections;
  }

  async verifyCollectionUser(collectionId) {
    const VERIFY_COLLECTION_USER = `
      SELECT user_username
      FROM collections
      WHERE id = $1
    `;

    try {
      const result = await dbQuery(VERIFY_COLLECTION_USER, collectionId);

      // Check if result.rows is an array and not empty
      if (Array.isArray(result.rows) && result.rows.length > 0) {
        return result.rows[0].user_username === this.username;
      } else {
        // Handle the case where result.rows is undefined or empty
        console.error("Error: Collection not found");
        return false;
      }
    } catch (error) {
      console.error("Error verifying collection user:", error.message);
      return false;
    }
  }

  //returns all collection names for specific user
  async getCollectionsForUser(page = 1, pageSize = 10) {
    const GET_COLLECTIONS_QUERY = `
      SELECT id, user_username, collection_name
      FROM collections
      WHERE user_username = $1
      ORDER BY id
      LIMIT $2 OFFSET $3
    `;

    const offset = (page - 1) * pageSize;
    const result = await dbQuery(
      GET_COLLECTIONS_QUERY,
      this.username,
      pageSize,
      offset
    );

    const totalCollectionsCount = await this.getTotalCollections();

    return {
      collections: result.rows,
      totalCollections: totalCollectionsCount,
    };
  }
  // update collection_name for collection/edit route
  async changeCollectionName(collectionId, newCollectionName) {
    const UPDATE_COLLECTION_NAME_QUERY = `
      UPDATE collections
      SET collection_name = $1
      WHERE id = $2 AND user_username = $3
    `;

    try {
      const result = await dbQuery(
        UPDATE_COLLECTION_NAME_QUERY,
        newCollectionName,
        collectionId,
        this.username
      );

      return result.rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        return false;
      }
      throw error;
    }
  }
  //delete collection for user on collection/edit route
  async deleteCollection(collectionId) {
    const DELETE_COLLECTION_QUERY = `
      DELETE FROM collections
      WHERE id = $1 AND user_username = $2
    `;

    const result = await dbQuery(
      DELETE_COLLECTION_QUERY,
      collectionId,
      this.username
    );

    return result.rowCount > 0;
  }
  //add collection for user on collections route
  async addCollection(collectionName) {
    const INSERT_COLLECTION_QUERY = `
      INSERT INTO collections (user_username, collection_name)
      VALUES ($1, $2)
    `;

    try {
      const result = await dbQuery(
        INSERT_COLLECTION_QUERY,
        this.username,
        collectionName
      );
      return result.rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }
  // method to return collection id in collections/edit route
  async getCollectionById(collectionId) {
    const GET_COLLECTION_BY_ID = `
    SELECT id, collection_name
    FROM collections
    WHERE id = $1 AND user_username = $2
  `;

    const result = await dbQuery(
      GET_COLLECTION_BY_ID,
      collectionId,
      this.username
    );
    return result.rows[0];
  }

  // Inside your PgPersistence class

  async getBookById(bookId) {
    const GET_BOOK_BY_ID = `
    SELECT id, title, author, collection_id
    FROM books
    WHERE id = $1 AND user_username = $2
  `;

    const result = await dbQuery(GET_BOOK_BY_ID, bookId, this.username);

    if (Array.isArray(result.rows) && result.rows.length > 0) {
      return result.rows[0];
    } else {
      // Handle the case where result.rows is undefined or empty
      console.error("Error: Book not found");
      return null;
    }
  }

  // query for book/edit-title route

  async editBookTitle(bookId, newTitle) {
    const EDIT_BOOK_TITLE_QUERY = `
    UPDATE books
    SET title = $1
    WHERE id = $2 AND user_username = $3
  `;

    const result = await dbQuery(
      EDIT_BOOK_TITLE_QUERY,
      newTitle,
      bookId,
      this.username
    );

    return result.rowCount > 0;
  }

  // query for book/edit-author route
  async editBookAuthor(bookId, newAuthor) {
    const EDIT_BOOK_AUTHOR_QUERY = `
    UPDATE books
    SET author = $1
    WHERE id = $2 AND user_username = $3
  `;

    const result = await dbQuery(
      EDIT_BOOK_AUTHOR_QUERY,
      newAuthor,
      bookId,
      this.username
    );

    return result.rowCount > 0;
  }

  //delete book from users collection
  async removeBookFromCollection(bookId) {
    const REMOVE_BOOK_FROM_COLLECTION_QUERY = `
      UPDATE books
      SET collection_id = NULL
      WHERE id = $1 AND user_username = $2
    `;

    const result = await dbQuery(
      REMOVE_BOOK_FROM_COLLECTION_QUERY,
      bookId,
      this.username
    );

    return result.rowCount > 0;
  }
  //return all books that belong to a user
  async getUsersBooks(page = 1, pageSize = 10) {
    const GET_BOOKS_QUERY = `
      SELECT b.id, b.collection_id, b.title, b.author, c.collection_name
      FROM books b
      LEFT JOIN collections c ON b.collection_id = c.id
      WHERE b.user_username = $1
      ORDER BY b.title
      LIMIT $2 OFFSET $3
    `;

    const offset = (page - 1) * pageSize;
    const result = await dbQuery(
      GET_BOOKS_QUERY,
      this.username,
      pageSize,
      offset
    );

    return result.rows;
  }

  async verifyBookUser(bookId) {
    const VERIFY_BOOK_USER = `
    SELECT user_username
    FROM books
    WHERE id = $1
  `;
    const result = await dbQuery(VERIFY_BOOK_USER, bookId);
    console.log(bookId);
    return result.rows[0].user_username === this.username;
  }
  //get total number of books a user has
  async getMaxBooks() {
    const GET_TOTAL_BOOKS = `
      SELECT COUNT(id) AS total_books
      FROM books 
      WHERE user_username = $1`;

    try {
      const result = await dbQuery(GET_TOTAL_BOOKS, this.username);
      const totalBooks = result.rows[0].total_books;
      return totalBooks;
    } catch (error) {
      throw error;
    }
  }
  //create a book in books table for user
  async addBook(title, author) {
    const ADD_BOOK_QUERY = `
      INSERT INTO books (title, author, user_username)
      VALUES ($1, $2, $3)
    `;

    try {
      const result = await dbQuery(
        ADD_BOOK_QUERY,
        title,
        author,
        this.username
      );

      return result.rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }
  //delete book
  async removeBook(bookId) {
    const REMOVE_BOOK_QUERY = `
      DELETE FROM books
      WHERE id = $1 AND user_username = $2
    `;

    const result = await dbQuery(REMOVE_BOOK_QUERY, bookId, this.username);

    return result.rowCount > 0;
  }
  //get books in a users  specific collection
  async getBooksInCollection(collectionId, page = 1, pageSize = 10) {
    page = parseInt(page) || 1;
    const GET_BOOKS_IN_COLLECTION_QUERY = `
        SELECT id, title, author
        FROM books
        WHERE collection_id = $1
        ORDER BY title
        LIMIT $2 OFFSET $3
    `;
    const offset = (page - 1) * pageSize;
    const result = await dbQuery(
      GET_BOOKS_IN_COLLECTION_QUERY,
      collectionId,
      pageSize,
      offset
    );

    // Get total count of books in the collection for pagination logic
    const GET_TOTAL_BOOKS_IN_COLLECTION_QUERY = `
        SELECT COUNT(id) AS total_books
        FROM books
        WHERE collection_id = $1
    `;
    const totalResult = await dbQuery(
      GET_TOTAL_BOOKS_IN_COLLECTION_QUERY,
      collectionId
    );

    const totalBooks = totalResult.rows[0].total_books;

    return {
      books: result.rows,
      totalBooks,
    };
  }

  async addBookToCollection(bookId, collectionId) {
    const ADD_BOOK_TO_COLLECTION_QUERY = `
      UPDATE books
      SET collection_id = $1
      WHERE id = $2 AND user_username = $3
    `;

    try {
      const result = await dbQuery(
        ADD_BOOK_TO_COLLECTION_QUERY,
        collectionId,
        bookId,
        this.username
      );

      return result.rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  // Returns true if error indicates a unique db constraint
  // violation, false otherwise
  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }
};
