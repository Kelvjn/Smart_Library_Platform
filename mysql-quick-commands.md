# Quick MySQL Commands to Check Your Data

## 🔌 Connect to MySQL
```bash
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u library_user -p"library_password" smart_library
```

## 📊 Quick Data Checks (Run these inside MySQL)

### 1. Show all tables
```sql
SHOW TABLES;
```

### 2. Count records
```sql
SELECT COUNT(*) FROM books;
SELECT COUNT(*) FROM authors;
```

### 3. Show all books
```sql
SELECT book_id, title, genre, total_copies, available_copies FROM books;
```

### 4. Show all authors
```sql
SELECT author_id, CONCAT(first_name, ' ', last_name) AS author_name FROM authors;
```

### 5. Show books with their authors
```sql
SELECT 
    b.title,
    CONCAT(a.first_name, ' ', a.last_name) AS author,
    b.genre,
    b.total_copies
FROM books b
LEFT JOIN book_authors ba ON b.book_id = ba.book_id
LEFT JOIN authors a ON ba.author_id = a.author_id
ORDER BY b.book_id;
```

### 6. Search for specific books
```sql
-- Find Fantasy books
SELECT title, genre FROM books WHERE genre LIKE '%Fantasy%';

-- Find books by specific author
SELECT b.title, CONCAT(a.first_name, ' ', a.last_name) AS author
FROM books b
JOIN book_authors ba ON b.book_id = ba.book_id
JOIN authors a ON ba.author_id = a.author_id
WHERE CONCAT(a.first_name, ' ', a.last_name) LIKE '%Rowling%';
```

### 7. Exit MySQL
```sql
EXIT;
```

## 🎯 Alternative: Use the Node.js Script
```bash
node check-data.js
```
This shows a nicely formatted view of all your data!
