-- Smart Library Platform - Sample Data for MySQL Workbench
-- Copy and paste this entire script into MySQL Workbench and execute it

USE smart_library;

-- Clear existing data (keep users)
DELETE FROM reviews;
DELETE FROM checkouts;
DELETE FROM book_authors;
DELETE FROM staff_logs;
DELETE FROM books;
DELETE FROM authors;

-- Insert sample authors
INSERT INTO authors (first_name, last_name, biography, nationality) VALUES
('Harper', 'Lee', 'American novelist known for To Kill a Mockingbird', 'American'),
('F. Scott', 'Fitzgerald', 'American novelist of the Jazz Age', 'American'),
('J.K.', 'Rowling', 'British author of the Harry Potter series', 'British'),
('J.R.R.', 'Tolkien', 'English author and philologist', 'British'),
('Frank', 'Herbert', 'American science fiction author', 'American'),
('J.D.', 'Salinger', 'American writer known for The Catcher in the Rye', 'American'),
('Terry', 'Pratchett', 'English author of comic fantasy novels', 'British'),
('Neil', 'Gaiman', 'English author of fantasy fiction', 'British'),
('Douglas', 'Adams', 'English author and humorist', 'British'),
('Yuval Noah', 'Harari', 'Israeli public intellectual and historian', 'Israeli'),
('Paulo', 'Coelho', 'Brazilian lyricist and novelist', 'Brazilian');

-- Insert sample books
INSERT INTO books (title, isbn, publisher, publication_date, genre, pages, description, total_copies, available_copies, is_ebook) VALUES
('To Kill a Mockingbird', '978-0-06-112008-4', 'Harper Perennial', '1960-07-11', 'Fiction', 376, 'A gripping tale of racial injustice and childhood innocence', 5, 5, TRUE),
('The Great Gatsby', '978-0-7432-7356-5', 'Scribner', '1925-04-10', 'Classic Literature', 180, 'A critique of the American Dream set in the Jazz Age', 8, 8, TRUE),
('Harry Potter and the Philosopher\'s Stone', '978-0-7475-3269-9', 'Bloomsbury', '1997-06-26', 'Fantasy', 223, 'The first book in the magical Harry Potter series', 12, 12, TRUE),
('The Lord of the Rings: The Fellowship of the Ring', '978-0-547-92822-7', 'Houghton Mifflin', '1954-07-29', 'Fantasy', 423, 'Epic fantasy adventure in Middle-earth', 6, 6, FALSE),
('Dune', '978-0-441-17271-9', 'Ace Books', '1965-08-01', 'Science Fiction', 688, 'Epic science fiction novel set on the desert planet Arrakis', 4, 4, TRUE),
('The Catcher in the Rye', '978-0-316-76948-0', 'Little, Brown and Company', '1951-07-16', 'Coming-of-age Fiction', 277, 'A controversial coming-of-age story', 7, 7, TRUE),
('Good Omens', '978-0-06-085398-0', 'William Morrow', '1990-05-10', 'Comedy', 288, 'A humorous take on the apocalypse', 3, 3, FALSE),
('The Hitchhiker\'s Guide to the Galaxy', '978-0-345-39180-3', 'Del Rey', '1979-10-12', 'Science Fiction Comedy', 224, 'A comedic space adventure', 5, 5, TRUE),
('Sapiens: A Brief History of Humankind', '978-0-06-231609-7', 'Harper', '2014-09-04', 'Non-fiction', 443, 'An exploration of human history and evolution', 6, 6, TRUE),
('The Alchemist', '978-0-06-231500-7', 'HarperOne', '1988-01-01', 'Adventure', 163, 'A philosophical novel about following your dreams', 9, 9, TRUE);

-- Link books to authors
INSERT INTO book_authors (book_id, author_id, author_order) VALUES
(1, 1, 1), -- To Kill a Mockingbird by Harper Lee
(2, 2, 1), -- The Great Gatsby by F. Scott Fitzgerald
(3, 3, 1), -- Harry Potter by J.K. Rowling
(4, 4, 1), -- Lord of the Rings by J.R.R. Tolkien
(5, 5, 1), -- Dune by Frank Herbert
(6, 6, 1), -- The Catcher in the Rye by J.D. Salinger
(7, 7, 1), -- Good Omens by Terry Pratchett
(7, 8, 2), -- Good Omens by Neil Gaiman (co-author)
(8, 9, 1), -- Hitchhiker's Guide by Douglas Adams
(9, 10, 1), -- Sapiens by Yuval Noah Harari
(10, 11, 1); -- The Alchemist by Paulo Coelho

-- Insert some sample checkouts
INSERT INTO checkouts (user_id, book_id, checkout_date, due_date, is_returned, staff_checkout_id) VALUES
(1, 1, '2024-01-10 10:00:00', '2024-01-24', TRUE, 1),
(1, 3, '2024-01-15 14:30:00', '2024-01-29', FALSE, 1);

-- Update books for checkouts
UPDATE books SET total_borrowed = total_borrowed + 1 WHERE book_id IN (1, 3);
UPDATE books SET available_copies = available_copies - 1 WHERE book_id = 3; -- Book 3 is still checked out

-- Insert some sample reviews
INSERT INTO reviews (user_id, book_id, rating, comment, is_verified) VALUES
(1, 1, 5, 'An absolutely fantastic book! A timeless classic that everyone should read.', TRUE),
(1, 3, 5, 'Magical and wonderful! Perfect introduction to the wizarding world.', TRUE);

-- Show results
SELECT 'Data population completed!' as STATUS;
SELECT 'Books' as Table_Name, COUNT(*) as Record_Count FROM books
UNION ALL
SELECT 'Authors', COUNT(*) FROM authors
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Checkouts', COUNT(*) FROM checkouts
UNION ALL
SELECT 'Reviews', COUNT(*) FROM reviews;
