# 📋 Complete Guide: How to Check Your Smart Library Data

## 🚀 Quick Start (Easiest Method)

### Option 1: Use the Node.js Script (Recommended)
```bash
# Navigate to your project directory
cd D:\Github_Test\Smart_Library_Platform

# Run the data checking script
node check-data.js
```
**This will show you:**
- Total count of books and authors
- Complete list of all books with authors, genres, publishers, and copy counts
- Books grouped by genre
- Nicely formatted output

---

## 🔧 Manual MySQL Commands

### Step 1: Connect to MySQL Database
```bash
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u library_user -p"library_password" smart_library
```

### Step 2: Once Connected to MySQL, Run These Commands

#### Basic Data Overview
```sql
-- Show all tables in the database
SHOW TABLES;

-- Count total books
SELECT COUNT(*) AS 'Total Books' FROM books;

-- Count total authors
SELECT COUNT(*) AS 'Total Authors' FROM authors;
```

#### View All Books
```sql
-- Simple book list
SELECT book_id, title, genre, publisher, total_copies, available_copies 
FROM books 
ORDER BY book_id;

-- Books with their authors (detailed view)
SELECT 
    b.title AS 'Book Title',
    CONCAT(a.first_name, ' ', a.last_name) AS 'Author',
    b.genre AS 'Genre',
    b.publisher AS 'Publisher',
    b.total_copies AS 'Total Copies',
    b.available_copies AS 'Available'
FROM books b
LEFT JOIN book_authors ba ON b.book_id = ba.book_id
LEFT JOIN authors a ON ba.author_id = a.author_id
ORDER BY b.book_id, ba.author_order;
```

#### Search and Filter
```sql
-- Find books by genre
SELECT title, genre, total_copies 
FROM books 
WHERE genre LIKE '%Fantasy%';

-- Find books by author
SELECT b.title, CONCAT(a.first_name, ' ', a.last_name) AS author
FROM books b
JOIN book_authors ba ON b.book_id = ba.book_id
JOIN authors a ON ba.author_id = a.author_id
WHERE CONCAT(a.first_name, ' ', a.last_name) LIKE '%Rowling%';

-- Books with most copies
SELECT title, total_copies, available_copies 
FROM books 
ORDER BY total_copies DESC 
LIMIT 5;
```

#### Analytics
```sql
-- Books by genre count
SELECT genre, COUNT(*) AS 'Number of Books' 
FROM books 
GROUP BY genre 
ORDER BY COUNT(*) DESC;

-- All authors
SELECT author_id, CONCAT(first_name, ' ', last_name) AS 'Author Name', nationality 
FROM authors 
ORDER BY author_id;
```

#### Exit MySQL
```sql
EXIT;
```

---

## 🎯 One-Line Commands (No Interactive MySQL)

### Quick Book Count
```bash
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u library_user -p"library_password" smart_library -e "SELECT COUNT(*) AS 'Total Books' FROM books;"
```

### Show First 5 Books
```bash
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u library_user -p"library_password" smart_library -e "SELECT book_id, title, genre, total_copies FROM books ORDER BY book_id LIMIT 5;"
```

### Show All Books with Authors
```bash
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u library_user -p"library_password" smart_library -e "SELECT b.title, CONCAT(a.first_name, ' ', a.last_name) AS author, b.genre FROM books b LEFT JOIN book_authors ba ON b.book_id = ba.book_id LEFT JOIN authors a ON ba.author_id = a.author_id ORDER BY b.book_id;"
```

### Genre Summary
```bash
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u library_user -p"library_password" smart_library -e "SELECT genre, COUNT(*) as count FROM books GROUP BY genre ORDER BY count DESC;"
```

---

## 📊 What You Should See

### Current Data in Your Database:
- **10 Books** across 9 different genres
- **11 Authors** (including co-authors)
- **Genres**: Fantasy (2), Fiction (1), Classic Literature (1), Science Fiction (1), etc.

### Sample Books:
1. **To Kill a Mockingbird** by Harper Lee (Fiction) - 5 copies
2. **The Great Gatsby** by F. Scott Fitzgerald (Classic Literature) - 8 copies
3. **Harry Potter and the Philosopher's Stone** by J.K. Rowling (Fantasy) - 12 copies
4. **The Lord of the Rings: The Fellowship of the Ring** by J.R.R. Tolkien (Fantasy) - 6 copies
5. **Dune** by Frank Herbert (Science Fiction) - 4 copies
6. **The Catcher in the Rye** by J.D. Salinger (Coming-of-age Fiction) - 7 copies
7. **Good Omens** by Terry Pratchett, Neil Gaiman (Comedy) - 3 copies
8. **The Hitchhiker's Guide to the Galaxy** by Douglas Adams (Science Fiction Comedy) - 5 copies
9. **Sapiens: A Brief History of Humankind** by Yuval Noah Harari (Non-fiction) - 6 copies
10. **The Alchemist** by Paulo Coelho (Adventure) - 9 copies

---

## 🔧 Troubleshooting

### If MySQL command not found:
The full path is: `"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"`

### If connection fails:
- Check your `.env` file has correct credentials
- Ensure MySQL service is running
- Verify user `library_user` exists with password `library_password`

### If node script fails:
- Make sure you're in the project directory: `D:\Github_Test\Smart_Library_Platform`
- Check that `node_modules` are installed: `npm install`
- Verify `.env` file exists with database credentials

---

## 💡 Pro Tips

1. **Fastest method**: `node check-data.js` - Shows everything formatted nicely
2. **Quick verification**: Use one-line MySQL commands for specific checks
3. **Deep analysis**: Use interactive MySQL session for complex queries
4. **Always navigate to project directory first**: `cd D:\Github_Test\Smart_Library_Platform`

---

## 📁 File Locations

- **Project Directory**: `D:\Github_Test\Smart_Library_Platform`
- **Database**: `smart_library` (MySQL)
- **Main Tables**: `books`, `authors`, `book_authors`, `users`, `checkouts`, `reviews`, `staff_logs`
- **Credentials**: Stored in `.env` file
- **Check Script**: `check-data.js`
