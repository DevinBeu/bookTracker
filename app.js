const config = require("./lib/config");
const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const PgPersistence = require("./lib/pg-persistence");
const store = require("connect-loki");
const catchError = require("./lib/catch-error");
const LokiStore = store(session);

const app = express();
const port = process.env.PORT;

//  setup and middleware
app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    cookie: {
      httpOnly: true,
      maxAge: 31 * 24 * 60 * 60 * 1000,
      path: "/",
      secure: false,
    },
    name: "booktracker-session-id",
    resave: false,
    saveUninitialized: true,
    secret: config.SECRET,
    store: new LokiStore({}),
  })
);
app.use(flash());

// create a new datastore for each request/response cycle
app.use((req, res, next) => {
  res.locals.store = new PgPersistence(req.session);
  next();
});

// xtract session info
app.use((req, res, next) => {
  res.locals.username = req.session.username;
  res.locals.signedIn = req.session.signedIn;
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});
const requiresCollectionsAuth = async (req, res, next) => {
  const collectionId = req.params.collectionId;

  const collectionAuth = await res.locals.store.verifyCollectionUser(
    collectionId
  );
  if (!collectionAuth) {
    return res.status(404).render("404", { message: "User not verified" });
  } else {
    next();
  }
};

const requiresBookAuth = async (req, res, next) => {
  const bookId = req.params.id;
  const bookAuth = await res.locals.store.verifyBookUser(bookId);

  if (!bookId) {
    return res.status(404).render("404", { message: "User not verified" });
  } else {
    next();
  }
};

// requires authentication middleware function altered from TODOs to provide redirect on sign in feature
const requiresAuthentication = (req, res, next) => {
  if (req.session && req.session.signedIn) {
    return next();
  } else {
    req.session.redirectTo = req.originalUrl; // Save the requested URL
    req.flash("error", "You must be logged in to access this page.");
    res.render("signin", {
      formData: { username: "" },
      flash: req.flash(),
    });
  }
};

// home route takes you to signin page
app.get("/", (req, res) => {
  res.redirect("/signin");
});

app.get(
  "/signin",
  catchError((req, res) => {
    // check if there's a saved url in the session
    const redirectTo = req.session.redirectTo || "/dashboard";

    if (res.locals.signedIn === true) {
      // already signed in? if so redirect to the dashboard or the saved URL
      res.redirect(redirectTo);
    } else {
      req.flash("info", "Please sign in.");
      res.render("signin", {
        formData: { username: "" },
        flash: req.flash(),
      });
    }
  })
);

app.post(
  "/signin",
  catchError(async (req, res) => {
    let username = req.body.username.trim();
    let password = req.body.password;

    if (!username || !password) {
      req.flash("error", "Username and password are required.");

      res.render("signin", {
        flash: req.flash(),
        formData: { username: username },
      });
      return;
    }

    let authenticated = await res.locals.store.authenticate(username, password);
    if (!authenticated) {
      req.flash("error", "Invalid credentials.");

      res.render("signin", {
        flash: req.flash(),
        formData: { username: username },
      });
      return;
    } else {
      // if authentication is successful set username, signedin flag, redirect to requested page, or dashboard
      let session = req.session;
      session.username = username;
      session.signedIn = true;
      req.flash("info", "Welcome!");
      const redirectTo = req.session.redirectTo || "/dashboard";
      res.redirect(redirectTo);
    }
  })
);

// dashboard route..not much functionality just a landing page
app.get(
  "/dashboard",
  requiresAuthentication,
  catchError((req, res) => {
    res.render("dashboard");
  })
);

app.get(
  "/collections",
  requiresAuthentication,
  catchError(async (req, res) => {
    const itemsPerPage = 5;

    // returns total collection
    const totalCollectionsCount = await res.locals.store.getTotalCollections();

    //  total number of pages
    const pageCount = Math.ceil(totalCollectionsCount / itemsPerPage);

    // parse the requested page number and coerce totalCollections from string to int
    let page = parseInt(req.query.page);
    if (+totalCollectionsCount === 0) {
      res.render("collections");
      return;
    }
    // validate the page number
    if (page <= 0 || page > pageCount) {
      // invalid page number, set a flash message and redirect back to collections 1st page
      req.flash("error", "Invalid page number requested.");
      return res.status(404).render("404", { message: "Page doesn't exist" });
    }

    // retreive collections for valid page number
    const collectionsData = await res.locals.store.getCollectionsForUser(
      page,
      itemsPerPage
    );
    //datacheck async function
    if (!collectionsData) {
      console.error("Error retrieving collections data");
      res.status(404).render("404");
      return;
    }
    const { collections, totalCollections } = collectionsData;

    res.render("collections", {
      collections,
      totalCollections,
      pageCount,
      currentPage: page,
      itemsPerPage,
    });
  })
);

app.get(
  "/collections/:collectionId",
  requiresAuthentication,
  requiresCollectionsAuth,
  catchError(async (req, res) => {
    const collectionId = req.params.collectionId;
    const page = parseInt(req.query.page);
    const itemsPerPage = 5;

    const booksData = await res.locals.store.getBooksInCollection(
      collectionId,
      page,
      itemsPerPage
    );

    if (!booksData) {
      console.error("Error retrieving books data");
      res.render("404");
      return;
    }

    const { books, totalBooks } = booksData;
    if (totalBooks == +0) {
      res.render("collectionBooks");
      return;
    }
    const pageCount = Math.ceil(totalBooks / itemsPerPage);

    if (page <= 0 || page > pageCount) {
      // Invalid page number, set a flash message and redirect to default page
      req.flash("error", "Invalid page number requested.");
      return res.status(404).render("404", { message: "Page doesn't exist" });
    }

    res.render("collectionBooks", {
      collectionId,
      books,
      totalBooks,
      pageCount,
      currentPage: page,
      itemsPerPage,
    });
  })
);

app.get(
  "/collections/edit/:collectionId",
  requiresAuthentication,
  requiresCollectionsAuth,
  catchError(async (req, res) => {
    const collectionId = req.params.collectionId;
    const collection = await res.locals.store.getCollectionById(collectionId);

    if (!collection) {
      console.error(`Error retrieving collection with ID ${collectionId}`);
      res.render("404");
      return;
    }

    res.render("editCollection", {
      collectionId: collection.id,
      collectionName: collection.collection_name,
    });
  })
);

app.post(
  "/collections/create",
  requiresAuthentication,

  [
    body("collectionName")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The collection name is required.")
      .isLength({ max: 100 })
      .withMessage("Collection name must be between 1 and 100 characters."),
  ],
  catchError(async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      errors.array().forEach((message) => req.flash("error", message.msg));
      res.redirect("/collections?page=1");
    } else {
      const result = await res.locals.store.addCollection(
        req.body.collectionName
      );
      if (!result) {
        req.flash(
          "error",
          `Collection name '${req.body.collectionName}' already exists.`
        );
      } else {
        req.flash("success", "Collection added successfully!");
      }
      res.redirect("/collections?page=1");
    }
  })
);

// collections edit route
app.post(
  "/collections/edit/:collectionId",
  requiresAuthentication,
  requiresCollectionsAuth,
  [
    body("newCollectionName")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The new collection name is required.")
      .isLength({ max: 100 })
      .withMessage("New collection name must be between 1 and 100 characters."),
  ],
  catchError(async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      errors.array().forEach((message) => req.flash("error", message.msg));
      res.redirect(`/collections/edit/${req.params.collectionId}`); // redirect back to the collection page
    } else {
      const collectionId = req.params.collectionId;
      const newCollectionName = req.body.newCollectionName;

      const result = await res.locals.store.changeCollectionName(
        collectionId,
        newCollectionName
      );

      if (!result) {
        req.flash(
          "error",
          `Failed to change collection name to '${newCollectionName}'.`
        );
      } else {
        req.flash("success", "Collection name changed successfully!");
      }
      res.redirect("/collections?page=1");
    }
  })
);

app.post(
  "/collections/delete/:id",
  requiresAuthentication,

  catchError(async (req, res) => {
    const collectionId = req.params.id;

    const deleted = await res.locals.store.deleteCollection(collectionId);

    if (deleted) {
      req.flash("success", "Successfully deleted!");
    } else {
      req.flash("error", "Failed to delete the collection.");
    }

    res.redirect("/collections?page=1");
  })
);
app.post(
  "/collections/remove-from-collection/:id",
  requiresAuthentication,
  requiresBookAuth,

  catchError(async (req, res) => {
    const { id } = req.params;
    const removalResult = await res.locals.store.removeBookFromCollection(id);

    if (removalResult) {
      req.flash("success", "Book removed from collection successfully");
    } else {
      req.flash("error", "Failed to remove book from collection");
    }

    res.redirect("/collections?page=1");
  })
);

app.get(
  "/books",
  requiresAuthentication,
  catchError(async (req, res) => {
    const itemsPerPage = 5;

    // fetch total books count
    const totalBooks = await res.locals.store.getMaxBooks();

    if (+totalBooks === 0) {
      res.render("books");
      return;
    }

    const pageCount = Math.ceil(totalBooks / itemsPerPage); // calculate total pages

    // initialize page variable and assign to the value of the query string
    let page = parseInt(req.query.page);

    // create an array of possible pages
    const allPages = Array.from({ length: pageCount }, (_, i) => i + 1);

    // validate the page number
    if (!allPages.includes(page) || page === 0) {
      // invalid page number, pass flash and redirect
      req.flash("error", "Invalid page number requested.");
      return res.status(404).render("404", { message: "Page doesn't exist" });
    }

    // fetch books for the valid page number
    const books = await res.locals.store.getUsersBooks(page, itemsPerPage);
    const { collections, totalCollections } =
      await res.locals.store.getCollectionsForUser();

    const formData = req.session.formData || { title: "", author: "" };

    res.render("books", {
      books,
      collections,
      totalBooks,
      pageCount,
      currentPage: page,
      itemsPerPage,
      formData,
    });

    // reset after rendering
    req.session.formData = {};
  })
);

app.post(
  "/books/add",
  requiresAuthentication,
  [
    body("title")
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("The title is required and must not exceed 100 characters."),
    body("author")
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("The author is required and must not exceed 50 characters."),
  ],
  catchError(async (req, res) => {
    const errors = validationResult(req);
    console.log(errors.array());

    if (!errors.isEmpty()) {
      req.session.formData = {
        title: req.body.title,
        author: req.body.author,
      };

      errors.array().forEach((message) => req.flash("error", message.msg));
    } else {
      // no validation errors, add the book
      const title = req.body.title;
      const author = req.body.author;

      const added = await res.locals.store.addBook(title, author);

      if (added) {
        req.flash("success", "Book added successfully!");
      } else {
        req.flash("error", "Failed to add the book.");
      }
    }

    res.redirect("/books?page=1");
  })
);

// handling the form submission to add a book to a collection
app.post(
  "/books/add-to-collection",
  requiresAuthentication,
  catchError(async (req, res) => {
    const bookId = req.body.bookId;
    const collectionId = req.body.collectionId;

    const result = await res.locals.store.addBookToCollection(
      bookId,
      collectionId
    );

    if (result) {
      req.flash("success", "Book added to collection successfully!");
    } else {
      req.flash("error", "Failed to add book to collection.");
    }

    res.redirect("/books?page=1"); // back to the books page
  })
);

app.post(
  "/books/remove/:id",
  requiresAuthentication,

  catchError(async (req, res) => {
    const bookId = req.params.id;
    const removed = await res.locals.store.removeBook(bookId);

    if (removed) {
      req.flash("success", "Book removed successfully!");
    } else {
      req.flash("error", "Failed to remove the book.");
    }

    res.redirect("/books?page=1");
  })
);
app.get(
  "/books/edit-title/:id",
  requiresAuthentication,

  catchError(async (req, res) => {
    const bookId = req.params.id;
    const book = await res.locals.store.getBookById(bookId);

    if (!book) {
      console.error(`Error retrieving book with ID ${bookId}`);
      res.render("404");
      return;
    }

    res.render("edit-title", {
      bookId: book.id,
      bookTitle: book.title,
    });
  })
);

app.post(
  "/books/edit-title/:id",
  requiresAuthentication,
  requiresBookAuth,
  [
    body("newTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The new title is required.")
      .isLength({ max: 100 })
      .withMessage("New title must be between 1 and 100 characters."),
  ],
  catchError(async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      errors.array().forEach((message) => req.flash("error", message.msg));
      res.redirect(`/books/edit-title/${req.params.id}`);
    } else {
      const bookId = req.params.id;
      const newTitle = req.body.newTitle;

      const result = await res.locals.store.editBookTitle(bookId, newTitle);

      if (!result) {
        req.flash("error", `Failed to edit title to '${newTitle}'.`);
      } else {
        req.flash("success", "Title edited successfully!");
      }
      res.redirect("/books?page=1");
    }
  })
);

app.get(
  "/books/edit-author/:id",
  requiresAuthentication,
  requiresBookAuth,
  catchError(async (req, res) => {
    const bookId = req.params.id;
    const book = await res.locals.store.getBookById(bookId);

    if (!book) {
      console.error(`Error retrieving book with ID ${bookId}`);
      res.render("404");
      return;
    }

    res.render("edit-author", {
      bookId: book.id,
      bookAuthor: book.author,
    });
  })
);

app.post(
  "/books/edit-author/:id",
  requiresAuthentication,
  requiresBookAuth,
  [
    body("newAuthor")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The new author is required.")
      .isLength({ max: 100 })
      .withMessage("New author must be between 1 and 100 characters."),
  ],
  catchError(async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      errors.array().forEach((message) => req.flash("error", message.msg));
      res.redirect(`/books/edit-author/${req.params.id}`);
    } else {
      const bookId = req.params.id;
      const newAuthor = req.body.newAuthor;

      const result = await res.locals.store.editBookAuthor(bookId, newAuthor);

      if (!result) {
        req.flash("error", `Failed to edit author to '${newAuthor}'.`);
      } else {
        req.flash("success", "Author edited successfully!");
      }
      res.redirect("/books?page=1");
    }
  })
);

// signout route
// app.post(
//   "/signout",
//   catchError((req, res) => {
//     req.session.destroy((err) => {
//       if (err) {
//         console.error(err);
//         return res.redirect("/dashboard");
//       }

//       res.redirect("/signin");
//     });
//   })
// );

app.post(
  "/signout",
  catchError((req, res) => {
    const redirectTo = "/signin";

    // Redirect before destroying the session
    res.redirect(redirectTo);

    // Destroy the session after the redirect
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
      }
    });
  })
);

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(404).render("404");
});

app.use((req, res) => {
  res.status(404).render("404");
});

// Server listening
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
