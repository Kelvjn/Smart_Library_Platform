-- Smart Library Platform - Sample Data Population
USE smart_library;

-- Clear existing data
DELETE FROM reviews;
DELETE FROM checkouts;
DELETE FROM book_authors;
DELETE FROM staff_logs;
DELETE FROM books;
DELETE FROM authors;
-- Keep existing users

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
('Paulo', 'Coelho', 'Brazilian lyricist and novelist', 'Brazilian'),
('George', 'Orwell', 'English novelist and essayist', 'British'),
('James', 'Clear', 'American author and speaker', 'American'),
('Robert C.', 'Martin', 'American software engineer and author', 'American'),
('Martin', 'Kleppmann', 'German computer scientist and author', 'German'),
('Tara', 'Westover', 'American memoirist', 'American'),
('Ernest', 'Hemingway', 'American novelist and journalist', 'American');

-- Insert sample books with cover images
INSERT INTO books (title, isbn, publisher, publication_date, genre, pages, description, total_copies, available_copies, is_ebook, cover_image_url) VALUES
('To Kill a Mockingbird', '978-0-06-112008-4', 'Harper Perennial', '1960-07-11', 'Fiction', 376, 'A gripping tale of racial injustice and childhood innocence', 5, 5, TRUE, 'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg'),
('The Great Gatsby', '978-0-7432-7356-5', 'Scribner', '1925-04-10', 'Classic Literature', 180, 'A critique of the American Dream set in the Jazz Age', 8, 8, TRUE, 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg'),
('Harry Potter and the Philosopher\'s Stone', '978-0-7475-3269-9', 'Bloomsbury', '1997-06-26', 'Fantasy', 223, 'The first book in the magical Harry Potter series', 12, 12, TRUE, 'https://covers.openlibrary.org/b/isbn/9780747532699-L.jpg'),
('The Lord of the Rings: The Fellowship of the Ring', '978-0-547-92822-7', 'Houghton Mifflin', '1954-07-29', 'Fantasy', 423, 'Epic fantasy adventure in Middle-earth', 6, 6, FALSE, 'https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg'),
('Dune', '978-0-441-17271-9', 'Ace Books', '1965-08-01', 'Science Fiction', 688, 'Epic science fiction novel set on the desert planet Arrakis', 4, 4, TRUE, 'https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg'),
('The Catcher in the Rye', '978-0-316-76948-0', 'Little, Brown and Company', '1951-07-16', 'Coming-of-age Fiction', 277, 'A controversial coming-of-age story', 7, 7, TRUE, 'https://covers.openlibrary.org/b/isbn/9780316769480-L.jpg'),
('Good Omens', '978-0-06-085398-0', 'William Morrow', '1990-05-10', 'Comedy', 288, 'A humorous take on the apocalypse', 3, 3, FALSE, 'https://covers.openlibrary.org/b/isbn/9780060853980-L.jpg'),
('The Hitchhiker\'s Guide to the Galaxy', '978-0-345-39180-3', 'Del Rey', '1979-10-12', 'Science Fiction Comedy', 224, 'A comedic space adventure', 5, 5, TRUE, 'https://covers.openlibrary.org/b/isbn/9780345391803-L.jpg'),
('Sapiens: A Brief History of Humankind', '978-0-06-231609-7', 'Harper', '2014-09-04', 'Non-fiction', 443, 'An exploration of human history and evolution', 6, 6, TRUE, 'https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg'),
('The Alchemist', '978-0-06-231500-7', 'HarperOne', '1988-01-01', 'Adventure', 163, 'A philosophical novel about following your dreams', 9, 9, TRUE, 'https://covers.openlibrary.org/b/isbn/9780062315007-L.jpg'),
('1984', '978-0-452-28423-4', 'Signet Classics', '1949-06-08', 'Dystopian Fiction', 328, 'A dystopian social science fiction novel', 6, 4, TRUE, 'https://covers.openlibrary.org/b/isbn/9780452284234-L.jpg'),
('Atomic Habits', '978-0-7352-1129-2', 'Avery', '2018-10-16', 'Self-Help', 320, 'An Easy & Proven Way to Build Good Habits & Break Bad Ones', 8, 4, TRUE, 'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg'),
('Clean Code', '978-0-13-235088-4', 'Prentice Hall', '2008-08-01', 'Programming', 464, 'A Handbook of Agile Software Craftsmanship', 5, 4, TRUE, 'https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg'),
('Designing Data-Intensive Applications', '978-1-449-37332-0', 'O\'Reilly Media', '2017-03-16', 'Computer Science', 616, 'The Big Ideas Behind Reliable, Scalable, and Maintainable Systems', 4, 3, TRUE, 'https://covers.openlibrary.org/b/isbn/9781449373320-L.jpg'),
('Educated', '978-0-399-59050-4', 'Random House', '2018-02-20', 'Memoir', 334, 'A Memoir by Tara Westover', 7, 3, TRUE, 'https://covers.openlibrary.org/b/isbn/9780399590504-L.jpg'),
('For Whom the Bell Tolls', '978-0-684-80335-7', 'Scribner', '1940-10-21', 'War Fiction', 471, 'A novel by Ernest Hemingway', 6, 4, TRUE, 'https://covers.openlibrary.org/b/isbn/9780684803357-L.jpg');

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
(10, 11, 1), -- The Alchemist by Paulo Coelho
(11, 12, 1), -- 1984 by George Orwell
(12, 13, 1), -- Atomic Habits by James Clear
(13, 14, 1), -- Clean Code by Robert C. Martin
(14, 15, 1), -- Designing Data-Intensive Applications by Martin Kleppmann
(15, 16, 1), -- Educated by Tara Westover
(16, 17, 1); -- For Whom the Bell Tolls by Ernest Hemingway

-- Insert some sample checkouts (optional)
INSERT INTO checkouts (user_id, book_id, checkout_date, due_date, is_returned, staff_checkout_id) VALUES
(3, 1, '2024-01-10 10:00:00', '2024-01-24', TRUE, 2),
(4, 3, '2024-01-15 14:30:00', '2024-01-29', FALSE, 2),
(3, 11, '2024-01-20 09:00:00', '2024-02-03', FALSE, 2), -- 1984 checked out
(4, 12, '2024-01-22 14:00:00', '2024-02-05', FALSE, 2), -- Atomic Habits checked out
(3, 13, '2024-01-25 11:30:00', '2024-02-08', FALSE, 2); -- Clean Code checked out

-- Update books availability for checked out books
UPDATE books SET available_copies = available_copies - 1, total_borrowed = total_borrowed + 1 WHERE book_id IN (1, 3, 11, 12, 13);
UPDATE books SET available_copies = available_copies + 1 WHERE book_id = 1; -- First book was returned

-- Insert some sample reviews
INSERT INTO reviews (user_id, book_id, rating, comment, is_verified) VALUES
(3, 1, 5, 'An absolutely fantastic book! A timeless classic that everyone should read.', TRUE),
(4, 3, 5, 'Magical and wonderful! Perfect introduction to the wizarding world.', TRUE),
(3, 5, 4, 'Epic science fiction masterpiece. The world-building is incredible.', TRUE),
(4, 11, 5, 'Disturbing but brilliant. Orwell\'s vision of totalitarianism is haunting.', TRUE),
(3, 12, 4, 'Practical advice for building better habits. Very actionable.', TRUE);

-- Verify the data
SELECT 'Data population completed successfully!' as status;
SELECT 'Books' as table_name, COUNT(*) as count FROM books
UNION ALL
SELECT 'Authors', COUNT(*) FROM authors
UNION ALL  
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Checkouts', COUNT(*) FROM checkouts
UNION ALL
SELECT 'Reviews', COUNT(*) FROM reviews;
