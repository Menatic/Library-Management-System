const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
require("dotenv").config();
const mysql = require("mysql2");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));

const limiter = rateLimit({
    windowMs: 90 * 120 * 2000, 
    max: 4000, 
});
app.use(limiter);

const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "libadmin",
    password: process.env.DB_PASSWORD || "qwertyuiop1234567890",
    database: process.env.DB_NAME || "libraryDB",
});

db.connect((err) => {
    if (err) {
        console.error("MySQL connection error:", err.message);
    } else {
        console.log("Connected to MySQL database");
    }
});

app.use((req, res, next) => {
    const apiKey = req.header("x-api-key");
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(403).json({ message: "Invalid API Key" });
    }
    next();
});

//Selecting all the books
app.get("/books", (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const sql = "SELECT * FROM Books LIMIT ? OFFSET ?";
    db.query(sql, [limit, offset], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

//Selecting one book with specific id
app.get("/books/:book_id", (req, res) => {
    const { book_id } = req.params;
    const sql = "SELECT * FROM Books WHERE book_id = ?";
    db.query(sql, [book_id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.length === 0) {
            return res.status(404).json({ message: "Book not found" });
        }
        res.json(result[0]);
    });
});

//Creating a new book 
app.post(
    "/books",
    [
        body("title").notEmpty().withMessage("Title is required"),
        body("author").notEmpty().withMessage("Author is required"),
        body("genre").notEmpty().withMessage("Genre is required"),
        body("isbn").notEmpty().withMessage("ISBN is required"),
        body("total_copies").isInt({ min: 1 }).withMessage("Total copies must be a positive integer"),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, author, genre, isbn, total_copies } = req.body;
        const sql = `INSERT INTO Books (title, author, genre, isbn, total_copies, available_copies) 
                     VALUES (?, ?, ?, ?, ?, ?)`;

        db.query(sql, [title, author, genre, isbn, total_copies, total_copies], (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: "Book added successfully", bookId: result.insertId });
        });
    }
);

//Updating a book
app.put(
    "/books/:book_id",
    [
        body("title").notEmpty().withMessage("Title is required"),
        body("author").notEmpty().withMessage("Author is required"),
        body("genre").notEmpty().withMessage("Genre is required"),
        body("isbn").notEmpty().withMessage("ISBN is required"),
        body("total_copies").isInt({ min: 1 }).withMessage("Total copies must be a positive integer"),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { book_id } = req.params;
        const { title, author, genre, isbn, total_copies } = req.body;

        const sql = `UPDATE Books SET title = ?, author = ?, genre = ?, isbn = ?, total_copies = ?, available_copies = ? 
                     WHERE book_id = ?`;

        db.query(sql, [title, author, genre, isbn, total_copies, total_copies, book_id], (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Book not found" });
            }
            res.json({ message: "Book updated successfully" });
        });
    }
);

//Deleting a book 
app.delete("/books/:book_id", (req, res) => {
    const { book_id } = req.params;
    const sql = "DELETE FROM Books WHERE book_id = ?";

    db.query(sql, [book_id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Book not found" });
        }
        res.json({ message: "Book deleted successfully" });
    });
});

//Borrowing a book 
app.patch("/books/:book_id/borrow", (req, res) => {
    const { book_id } = req.params;

    const sql = `UPDATE Books 
                 SET available_copies = available_copies - 1 
                 WHERE book_id = ? AND available_copies > 0`;

    db.query(sql, [book_id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Book not available for borrowing" });
        }
        res.json({ message: "Book borrowed successfully" });
    });
});

//Returning a book
app.patch("/books/:book_id/return", (req, res) => {
    const { book_id } = req.params;

    const sql = `UPDATE Books 
                 SET available_copies = available_copies + 1 
                 WHERE book_id = ? AND available_copies < total_copies`;

    db.query(sql, [book_id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Cannot return book, all copies are already available" });
        }
        res.json({ message: "Book returned successfully" });
    });
});

//Selecting all members
app.get("/members", (req, res) => {
    const sql = "SELECT * FROM Members";
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Selecting one specific member
app.get("/members/:member_id", (req, res) => {
    const { member_id } = req.params;
    const sql = "SELECT * FROM Members WHERE member_id = ?";
    db.query(sql, [member_id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.length === 0) {
            return res.status(404).json({ message: "Member not found" });
        }
        res.json(result[0]);
    });
});

// Creating a new member
app.post(
    "/members",
    [
        body("name").notEmpty().withMessage("Name is required"),
        body("email").isEmail().withMessage("Invalid email"),
        body("phone").notEmpty().withMessage("Phone is required"),
        body("membership_type").isIn(["Standard", "Premium"]).withMessage("Invalid membership type"),
        body("address").notEmpty().withMessage("Address is required"),
        body("password").notEmpty().withMessage("Password is required"),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, phone, membership_type, address, password } = req.body;
        const sql = `INSERT INTO Members (name, email, phone, membership_type, address, password) 
                     VALUES (?, ?, ?, ?, ?, ?)`;

        db.query(sql, [name, email, phone, membership_type, address, password], (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: "Member added successfully", memberId: result.insertId });
        });
    }
);

// Updating a member
app.put(
    "/members/:member_id",
    [
        body("name").notEmpty().withMessage("Name is required"),
        body("email").isEmail().withMessage("Invalid email"),
        body("phone").notEmpty().withMessage("Phone is required"),
        body("membership_type").isIn(["Standard", "Premium"]).withMessage("Invalid membership type"),
        body("address").notEmpty().withMessage("Address is required"),
        body("password").notEmpty().withMessage("Password is required"),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { member_id } = req.params;
        const { name, email, phone, membership_type, address, password } = req.body;

        const sql = `UPDATE Members SET name = ?, email = ?, phone = ?, membership_type = ?, address = ?, password = ? 
                     WHERE member_id = ?`;

        db.query(sql, [name, email, phone, membership_type, address, password, member_id], (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Member not found" });
            }
            res.json({ message: "Member updated successfully" });
        });
    }
);

// Selecting all issuances
app.get("/issuances", (req, res) => {
    const sql = "SELECT * FROM Issuance";
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Creating a new issuance
app.post(
    "/issuances",
    [
        body("member_id").isInt({ min: 1 }).withMessage("Member ID is required"),
        body("book_id").isInt({ min: 1 }).withMessage("Book ID is required"),
        body("due_date").isDate().withMessage("Invalid due date"),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { member_id, book_id, due_date } = req.body;
        const sql = `INSERT INTO Issuance (member_id, book_id, due_date) 
                     VALUES (?, ?, ?)`;

        db.query(sql, [member_id, book_id, due_date], (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: "Issuance added successfully", issuanceId: result.insertId });
        });
    }
);

// Updating an issuance
app.patch("/issuances/:issuance_id/return", (req, res) => {
    const { issuance_id } = req.params;
    const sql = `UPDATE Issuance SET returned_date = CURRENT_DATE WHERE issuance_id = ?`;

    db.query(sql, [issuance_id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Issuance not found" });
        }
        res.json({ message: "Book returned successfully" });
    });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong!" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));