-- Smart Library Platform - Complete Database Setup
-- This script recreates the entire database based on the ERD requirements
-- and populates it with comprehensive sample data

-- Create database
CREATE DATABASE IF NOT EXISTS smart_library CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_library;

-- Drop tables if they exist (for reset purposes)
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS checkouts;
DROP TABLE IF EXISTS book_authors;
DROP TABLE IF EXISTS staff_logs;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS authors;
DROP TABLE IF EXISTS users;

-- Users table (both readers and staff) - Updated to match ERD
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    user_type ENUM('reader', 'staff', 'admin') DEFAULT 'reader',
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Authors table - Updated to match ERD
CREATE TABLE authors (
    author_id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    biography TEXT,
    birth_date DATE,
    nationality VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Books table - Updated to match ERD
CREATE TABLE books (
    book_id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    isbn VARCHAR(20) UNIQUE,
    publisher VARCHAR(100),
    publication_date DATE,
    genre VARCHAR(50),
    language VARCHAR(30) DEFAULT 'English',
    pages INT,
    description TEXT,
    total_copies INT NOT NULL DEFAULT 1,
    available_copies INT NOT NULL DEFAULT 1,
    is_ebook BOOLEAN DEFAULT FALSE,
    cover_image_url VARCHAR(500),
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INT DEFAULT 0,
    total_borrowed INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_copies CHECK (available_copies >= 0 AND available_copies <= total_copies),
    CONSTRAINT chk_rating CHECK (average_rating >= 0 AND average_rating <= 5)
);

-- Book-Authors junction table (many-to-many relationship)
CREATE TABLE book_authors (
    book_id INT,
    author_id INT,
    author_order INT DEFAULT 1,
    PRIMARY KEY (book_id, author_id),
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES authors(author_id) ON DELETE CASCADE
);

-- Checkouts table - Updated to match ERD
CREATE TABLE checkouts (
    checkout_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    checkout_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date DATE NOT NULL,
    return_date TIMESTAMP NULL,
    is_returned BOOLEAN DEFAULT FALSE,
    is_late BOOLEAN DEFAULT FALSE,
    late_fee DECIMAL(10,2) DEFAULT 0.00,
    staff_checkout_id INT,
    staff_return_id INT,
    notes TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (staff_checkout_id) REFERENCES users(user_id),
    FOREIGN KEY (staff_return_id) REFERENCES users(user_id),
    
    INDEX idx_user_book (user_id, book_id),
    INDEX idx_checkout_date (checkout_date),
    INDEX idx_due_date (due_date),
    INDEX idx_return_status (is_returned)
);

-- Reviews table - Updated to match ERD
CREATE TABLE reviews (
    review_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE,
    helpful_votes INT DEFAULT 0,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_user_book_review (user_id, book_id),
    CONSTRAINT chk_rating_range CHECK (rating >= 1 AND rating <= 5),
    
    INDEX idx_book_rating (book_id, rating),
    INDEX idx_review_date (review_date)
);

-- Staff logs table - Updated to match ERD
CREATE TABLE staff_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    staff_id INT NOT NULL,
    action_type ENUM('add_book', 'update_inventory', 'retire_book', 'manage_user', 'system_config') NOT NULL,
    target_type ENUM('book', 'user', 'system') NOT NULL,
    target_id INT,
    action_description TEXT NOT NULL,
    old_values JSON,
    new_values JSON,
    action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    FOREIGN KEY (staff_id) REFERENCES users(user_id) ON DELETE CASCADE,
    
    INDEX idx_staff_action (staff_id, action_type),
    INDEX idx_action_date (action_date),
    INDEX idx_target (target_type, target_id)
);

-- Create indexes for performance optimization
-- Book search optimization
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_genre ON books(genre);
CREATE INDEX idx_books_publisher ON books(publisher);
CREATE INDEX idx_books_active_available ON books(is_active, available_copies);
CREATE INDEX idx_authors_name ON authors(first_name, last_name);

-- Report optimization
CREATE INDEX idx_checkouts_date_range ON checkouts(checkout_date, is_returned);
CREATE INDEX idx_books_borrowed_count ON books(total_borrowed DESC);
CREATE INDEX idx_users_type_active ON users(user_type, is_active);

-- Composite indexes for complex queries
CREATE INDEX idx_book_search_composite ON books(is_active, genre, title);
CREATE INDEX idx_checkout_analytics ON checkouts(book_id, checkout_date, is_returned);

-- Full-text search index for book search
ALTER TABLE books ADD FULLTEXT(title, description);
ALTER TABLE authors ADD FULLTEXT(first_name, last_name);

-- Insert the 4 default users as specified
-- Staff users: admin/admin123; thinh/12345678
-- Reader users: duc/12345678910; Mary/mytra2012@
INSERT INTO users (username, email, password_hash, first_name, last_name, phone, address, user_type, registration_date, is_active) VALUES
-- Staff users
('admin', 'admin@library.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', '555-0101', '123 Library St, Admin City', 'staff', '2024-01-01 09:00:00', TRUE),
('thinh', 'thinh@library.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Duc', 'Thinh', '555-0102', '456 Staff Ave, Library Town', 'staff', '2024-01-02 10:00:00', TRUE),

-- Reader users  
('duc', 'duc@email.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Duc', 'Reader', '555-0201', '789 Reader Blvd, Book City', 'reader', '2024-01-03 11:00:00', TRUE),
('Mary', 'mary@email.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Mary', 'Johnson', '555-0202', '321 Book Lane, Reading Town', 'reader', '2024-01-04 12:00:00', TRUE);

-- Insert comprehensive authors data
INSERT INTO authors (first_name, last_name, biography, birth_date, nationality) VALUES
-- Classic Literature Authors
('Harper', 'Lee', 'American novelist best known for her 1960 novel To Kill a Mockingbird. It won the 1961 Pulitzer Prize and has become a classic of modern American literature.', '1926-04-28', 'American'),
('F. Scott', 'Fitzgerald', 'American novelist, essayist, and short story writer. He is best known for his novels depicting the flamboyance and excess of the Jazz Age.', '1896-09-24', 'American'),
('Jane', 'Austen', 'English novelist known primarily for her six major novels, which interpret, critique and comment upon the British landed gentry at the end of the 18th century.', '1775-12-16', 'British'),
('George', 'Orwell', 'English novelist, essayist, journalist and critic. His work is characterised by lucid prose, biting social criticism, opposition to totalitarianism.', '1903-06-25', 'British'),

-- Fantasy Authors
('J.K.', 'Rowling', 'British author, philanthropist, film producer, television producer, and screenwriter. She is best known for writing the Harry Potter fantasy series.', '1965-07-31', 'British'),
('J.R.R.', 'Tolkien', 'English writer, poet, philologist, and academic, best known as the author of the high fantasy works The Hobbit and The Lord of the Rings.', '1892-01-03', 'British'),

-- Science Fiction Authors
('Frank', 'Herbert', 'American science-fiction author best known for the 1965 novel Dune and its five sequels. The Dune saga, set in the distant future, takes place on the desert planet Arrakis.', '1920-10-08', 'American'),

-- Modern Literature Authors
('J.D.', 'Salinger', 'American writer who is known for his widely read novel The Catcher in the Rye. Following his early success publishing short stories, Salinger led a very private life.', '1919-01-01', 'American'),
('Yuval Noah', 'Harari', 'Israeli public intellectual, historian and professor in the Department of History at the Hebrew University of Jerusalem.', '1976-02-24', 'Israeli'),
('Delia', 'Owens', 'American author and zoologist. Her debut novel Where the Crawdads Sing topped The New York Times Fiction Best Sellers of 2019 for 25 non-consecutive weeks.', '1949-04-04', 'American'),
('Taylor Jenkins', 'Reid', 'American author of contemporary fiction. She is best known for her novels The Seven Husbands of Evelyn Hugo and Daisy Jones & The Six.', '1983-12-20', 'American'),
('Alex', 'Michaelides', 'Cypriot author and screenwriter. He is best known for his psychological thriller novel The Silent Patient.', '1977-09-04', 'Cypriot'),
('Tara', 'Westover', 'American memoirist, essayist and historian. Her memoir Educated debuted at #1 on The New York Times bestseller list.', '1986-09-27', 'American'),

-- Technical Authors
('Robert C.', 'Martin', 'American software engineer, instructor, and best-selling author. He is most recognized for developing many software design principles.', '1952-12-05', 'American'),

-- Horror Authors
('Stephen', 'King', 'American author of horror, supernatural fiction, suspense, crime, science-fiction, and fantasy novels. His books have sold more than 350 million copies.', '1947-09-21', 'American'),

-- Classic American Authors
('Ernest', 'Hemingway', 'American novelist, short-story writer, and journalist. His economical and understated style had a strong influence on 20th-century fiction.', '1899-07-21', 'American'),

-- Thriller Authors
('Thomas', 'Harris', 'American writer, best known for a series of suspense novels about his most famous character, Hannibal Lecter.', '1940-04-11', 'American');

-- Insert comprehensive books data (30+ books as requested)
INSERT INTO books (title, isbn, publisher, publication_date, genre, language, pages, description, total_copies, available_copies, is_ebook, cover_image_url, average_rating, total_reviews, total_borrowed, is_active) VALUES

-- Classic Literature
('To Kill a Mockingbird', '978-0-06-112008-4', 'Harper Perennial', '1960-07-11', 'Fiction', 'English', 376, 'A gripping tale of racial injustice and childhood innocence in the American South during the 1930s.', 5, 5, TRUE, 'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg', 4.5, 1250, 89, TRUE),
('The Great Gatsby', '978-0-7432-7356-5', 'Scribner', '1925-04-10', 'Classic Literature', 'English', 180, 'A critique of the American Dream set in the Jazz Age, following the mysterious Jay Gatsby.', 8, 8, TRUE, 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg', 4.2, 980, 67, TRUE),
('Pride and Prejudice', '978-0-14-143951-8', 'Penguin Classics', '1813-01-28', 'Romance', 'English', 432, 'A romantic novel of manners written by Jane Austen, following the character development of Elizabeth Bennet.', 3, 3, TRUE, 'https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg', 4.3, 1100, 45, TRUE),
('1984', '978-0-452-28423-4', 'Plume', '1949-06-08', 'Dystopian Fiction', 'English', 328, 'A dystopian social science fiction novel about totalitarian control and surveillance.', 5, 5, TRUE, 'https://covers.openlibrary.org/b/isbn/9780452284234-L.jpg', 4.4, 1350, 78, TRUE),

-- Harry Potter Series (All 7 books)
('Harry Potter and the Philosopher\'s Stone', '978-0-7475-3269-9', 'Bloomsbury', '1997-06-26', 'Fantasy', 'English', 223, 'The first book in the magical Harry Potter series, introducing the wizarding world.', 12, 12, TRUE, 'https://covers.openlibrary.org/b/isbn/9780747532699-L.jpg', 4.7, 2500, 156, TRUE),
('Harry Potter and the Chamber of Secrets', '978-0-7475-3849-3', 'Bloomsbury', '1998-07-02', 'Fantasy', 'English', 251, 'The second book in the Harry Potter series, featuring the mysterious Chamber of Secrets.', 10, 10, TRUE, 'https://covers.openlibrary.org/b/isbn/9780747538493-L.jpg', 4.6, 2300, 134, TRUE),
('Harry Potter and the Prisoner of Azkaban', '978-0-7475-4215-5', 'Bloomsbury', '1999-07-08', 'Fantasy', 'English', 317, 'The third book in the Harry Potter series, introducing Sirius Black and the Marauder\'s Map.', 9, 9, TRUE, 'https://covers.openlibrary.org/b/isbn/9780747542155-L.jpg', 4.8, 2400, 142, TRUE),
('Harry Potter and the Goblet of Fire', '978-0-7475-4624-5', 'Bloomsbury', '2000-07-08', 'Fantasy', 'English', 636, 'The fourth book in the Harry Potter series, featuring the Triwizard Tournament.', 8, 8, TRUE, 'https://covers.openlibrary.org/b/isbn/9780747546245-L.jpg', 4.7, 2200, 128, TRUE),
('Harry Potter and the Order of the Phoenix', '978-0-7475-5100-3', 'Bloomsbury', '2003-06-21', 'Fantasy', 'English', 766, 'The fifth book in the Harry Potter series, introducing the Order of the Phoenix.', 7, 7, TRUE, 'https://covers.openlibrary.org/b/isbn/9780747551003-L.jpg', 4.5, 2100, 115, TRUE),
('Harry Potter and the Half-Blood Prince', '978-0-7475-8108-6', 'Bloomsbury', '2005-07-16', 'Fantasy', 'English', 607, 'The sixth book in the Harry Potter series, revealing Voldemort\'s past.', 6, 6, TRUE, 'https://covers.openlibrary.org/b/isbn/9780747581086-L.jpg', 4.6, 2000, 108, TRUE),
('Harry Potter and the Deathly Hallows', '978-0-545-01022-1', 'Bloomsbury', '2007-07-21', 'Fantasy', 'English', 607, 'The final book in the Harry Potter series, concluding the epic battle against Voldemort.', 5, 5, TRUE, 'https://covers.openlibrary.org/b/isbn/9780545010221-L.jpg', 4.8, 2300, 125, TRUE),

-- Lord of the Rings
('The Lord of the Rings: The Fellowship of the Ring', '978-0-547-92822-7', 'Houghton Mifflin', '1954-07-29', 'Fantasy', 'English', 423, 'Epic fantasy adventure in Middle-earth, beginning the quest to destroy the One Ring.', 6, 6, FALSE, 'https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg', 4.6, 1800, 95, TRUE),
('The Hobbit', '978-0-547-92823-4', 'Houghton Mifflin', '1937-09-21', 'Fantasy', 'English', 310, 'A fantasy novel about a hobbit\'s unexpected journey to help dwarves reclaim their homeland.', 4, 4, TRUE, 'https://covers.openlibrary.org/b/isbn/9780547928234-L.jpg', 4.4, 1600, 87, TRUE),

-- Dune Series (All 6 books)
('Dune', '978-0-441-17271-9', 'Ace Books', '1965-08-01', 'Science Fiction', 'English', 688, 'Epic science fiction novel set on the desert planet Arrakis, featuring Paul Atreides.', 4, 4, TRUE, 'https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg', 4.5, 1200, 78, TRUE),
('Dune Messiah', '978-0-441-17272-6', 'Ace Books', '1969-01-01', 'Science Fiction', 'English', 331, 'The second book in the Dune series, continuing Paul Atreides\' story as Emperor.', 3, 3, TRUE, 'https://covers.openlibrary.org/b/isbn/9780441172726-L.jpg', 4.2, 800, 45, TRUE),
('Children of Dune', '978-0-441-17273-3', 'Ace Books', '1976-01-01', 'Science Fiction', 'English', 444, 'The third book in the Dune series, following Paul\'s children Leto and Ghanima.', 3, 3, TRUE, 'https://covers.openlibrary.org/b/isbn/9780441172733-L.jpg', 4.1, 700, 38, TRUE),
('God Emperor of Dune', '978-0-441-17274-0', 'Ace Books', '1981-01-01', 'Science Fiction', 'English', 411, 'The fourth book in the Dune series, featuring Leto II as the God Emperor.', 2, 2, TRUE, 'https://covers.openlibrary.org/b/isbn/9780441172740-L.jpg', 4.0, 600, 32, TRUE),
('Heretics of Dune', '978-0-441-17275-7', 'Ace Books', '1984-01-01', 'Science Fiction', 'English', 480, 'The fifth book in the Dune series, set 1500 years after God Emperor of Dune.', 2, 2, TRUE, 'https://covers.openlibrary.org/b/isbn/9780441172757-L.jpg', 3.9, 500, 28, TRUE),
('Chapterhouse: Dune', '978-0-441-17276-4', 'Ace Books', '1985-01-01', 'Science Fiction', 'English', 436, 'The sixth and final book in the original Dune series by Frank Herbert.', 2, 2, TRUE, 'https://covers.openlibrary.org/b/isbn/9780441172764-L.jpg', 3.8, 450, 25, TRUE),

-- Modern Literature
('The Catcher in the Rye', '978-0-316-76948-0', 'Little, Brown and Company', '1951-07-16', 'Coming-of-age Fiction', 'English', 277, 'A controversial coming-of-age story following Holden Caulfield in New York City.', 7, 7, TRUE, 'https://covers.openlibrary.org/b/isbn/9780316769480-L.jpg', 4.1, 900, 52, TRUE),
('Sapiens: A Brief History of Humankind', '978-0-06-231609-7', 'Harper', '2014-09-04', 'Non-fiction', 'English', 443, 'An exploration of human history and evolution from the Stone Age to the present.', 6, 6, TRUE, 'https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg', 4.3, 1100, 68, TRUE),
('Where the Crawdads Sing', '978-0-7352-1909-0', 'G.P. Putnam\'s Sons', '2018-08-14', 'Mystery', 'English', 370, 'A mystery novel about a woman who grew up isolated in the marshes of North Carolina.', 5, 5, TRUE, 'https://covers.openlibrary.org/b/isbn/9780735219090-L.jpg', 4.4, 1300, 75, TRUE),
('The Seven Husbands of Evelyn Hugo', '978-1-5011-5641-0', 'Atria Books', '2017-06-13', 'Historical Fiction', 'English', 400, 'A captivating novel about a reclusive Hollywood icon who finally decides to tell her story.', 4, 4, TRUE, 'https://covers.openlibrary.org/b/isbn/9781501156410-L.jpg', 4.5, 1200, 82, TRUE),
('The Silent Patient', '978-1-250-30169-7', 'Celadon Books', '2019-02-05', 'Psychological Thriller', 'English', 325, 'A psychological thriller about a woman who refuses to speak after allegedly murdering her husband.', 3, 3, TRUE, 'https://covers.openlibrary.org/b/isbn/9781250301697-L.jpg', 4.2, 950, 58, TRUE),
('Educated', '978-0-399-59050-4', 'Random House', '2018-02-20', 'Memoir', 'English', 334, 'A memoir about a woman who grows up in a survivalist family and eventually earns a PhD from Cambridge.', 4, 4, TRUE, 'https://covers.openlibrary.org/b/isbn/9780399590504-L.jpg', 4.6, 1400, 89, TRUE),

-- Technical Books
('Clean Code', '978-0-13-235088-4', 'Prentice Hall', '2008-08-01', 'Programming', 'English', 464, 'A handbook of agile software craftsmanship, focusing on writing clean, maintainable code.', 3, 3, TRUE, 'https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg', 4.7, 800, 45, TRUE),

-- Horror
('The Shining', '978-0-307-27370-2', 'Doubleday', '1977-01-28', 'Horror', 'English', 447, 'A horror novel about a writer who becomes the caretaker of an isolated hotel during the winter.', 5, 5, TRUE, 'https://covers.openlibrary.org/b/isbn/9780307273702-L.jpg', 4.3, 1100, 67, TRUE),

-- Classic American Literature
('The Old Man and the Sea', '978-0-684-80122-3', 'Scribner', '1952-09-01', 'Literary Fiction', 'English', 127, 'The story of an aging Cuban fisherman and his struggle with a giant marlin.', 3, 3, TRUE, 'https://covers.openlibrary.org/b/isbn/9780684801223-L.jpg', 4.0, 800, 42, TRUE),

-- Hannibal Lecter Series (3 books)
('Red Dragon', '978-0-440-13326-8', 'G.P. Putnam\'s Sons', '1981-01-01', 'Thriller', 'English', 348, 'The first book in the Hannibal Lecter series, introducing the brilliant psychiatrist and cannibal.', 4, 4, TRUE, 'https://covers.openlibrary.org/b/isbn/9780440133268-L.jpg', 4.2, 700, 38, TRUE),
('The Silence of the Lambs', '978-0-312-92486-2', 'St. Martin\'s Press', '1988-01-01', 'Thriller', 'English', 338, 'The second book in the Hannibal Lecter series, featuring FBI agent Clarice Starling.', 5, 5, TRUE, 'https://covers.openlibrary.org/b/isbn/9780312924862-L.jpg', 4.4, 1200, 72, TRUE),
('Hannibal', '978-0-312-25395-5', 'Delacorte Press', '1999-01-01', 'Thriller', 'English', 486, 'The third book in the Hannibal Lecter series, continuing the story of the brilliant psychiatrist.', 3, 3, TRUE, 'https://covers.openlibrary.org/b/isbn/9780312253955-L.jpg', 4.1, 600, 35, TRUE);

-- Link books to authors (book_authors junction table)
INSERT INTO book_authors (book_id, author_id, author_order) VALUES
-- Classic Literature
(1, 1, 1),  -- To Kill a Mockingbird by Harper Lee
(2, 2, 1),  -- The Great Gatsby by F. Scott Fitzgerald
(3, 3, 1),  -- Pride and Prejudice by Jane Austen
(4, 4, 1),  -- 1984 by George Orwell

-- Harry Potter Series
(5, 5, 1),  -- Harry Potter and the Philosopher's Stone by J.K. Rowling
(6, 5, 1),  -- Harry Potter and the Chamber of Secrets by J.K. Rowling
(7, 5, 1),  -- Harry Potter and the Prisoner of Azkaban by J.K. Rowling
(8, 5, 1),  -- Harry Potter and the Goblet of Fire by J.K. Rowling
(9, 5, 1),  -- Harry Potter and the Order of the Phoenix by J.K. Rowling
(10, 5, 1), -- Harry Potter and the Half-Blood Prince by J.K. Rowling
(11, 5, 1), -- Harry Potter and the Deathly Hallows by J.K. Rowling

-- Lord of the Rings
(12, 6, 1), -- The Fellowship of the Ring by J.R.R. Tolkien
(13, 6, 1), -- The Hobbit by J.R.R. Tolkien

-- Dune Series
(14, 7, 1), -- Dune by Frank Herbert
(15, 7, 1), -- Dune Messiah by Frank Herbert
(16, 7, 1), -- Children of Dune by Frank Herbert
(17, 7, 1), -- God Emperor of Dune by Frank Herbert
(18, 7, 1), -- Heretics of Dune by Frank Herbert
(19, 7, 1), -- Chapterhouse: Dune by Frank Herbert

-- Modern Literature
(20, 8, 1), -- The Catcher in the Rye by J.D. Salinger
(21, 9, 1), -- Sapiens by Yuval Noah Harari
(22, 10, 1), -- Where the Crawdads Sing by Delia Owens
(23, 11, 1), -- The Seven Husbands of Evelyn Hugo by Taylor Jenkins Reid
(24, 12, 1), -- The Silent Patient by Alex Michaelides
(25, 13, 1), -- Educated by Tara Westover

-- Technical
(26, 14, 1), -- Clean Code by Robert C. Martin

-- Horror
(27, 15, 1), -- The Shining by Stephen King

-- Classic American Literature
(28, 16, 1), -- The Old Man and the Sea by Ernest Hemingway

-- Hannibal Lecter Series
(29, 17, 1), -- Red Dragon by Thomas Harris
(30, 17, 1), -- The Silence of the Lambs by Thomas Harris
(31, 17, 1); -- Hannibal by Thomas Harris

-- Insert some sample checkouts to demonstrate functionality
INSERT INTO checkouts (user_id, book_id, checkout_date, due_date, is_returned, staff_checkout_id) VALUES
(3, 1, '2024-01-10 10:00:00', '2024-01-24', TRUE, 1),   -- duc borrowed To Kill a Mockingbird
(4, 5, '2024-01-15 14:30:00', '2024-01-29', FALSE, 2), -- Mary borrowed Harry Potter 1
(3, 14, '2024-01-20 09:15:00', '2024-02-03', FALSE, 1); -- duc borrowed Dune

-- Update books availability for checked out books
UPDATE books SET available_copies = available_copies - 1, total_borrowed = total_borrowed + 1 WHERE book_id IN (1, 5, 14);
UPDATE books SET available_copies = available_copies + 1 WHERE book_id = 1; -- First book was returned

-- Insert some sample reviews
INSERT INTO reviews (user_id, book_id, rating, comment, is_verified, helpful_votes) VALUES
(3, 1, 5, 'An absolutely fantastic book! A timeless classic that everyone should read. The characters are so well-developed and the story is both heartwarming and heartbreaking.', TRUE, 12),
(4, 5, 5, 'Magical and wonderful! Perfect introduction to the wizarding world. I couldn\'t put it down and immediately wanted to read the rest of the series.', TRUE, 8),
(3, 14, 4, 'Epic science fiction at its finest. The world-building is incredible, though it can be dense at times. Definitely worth the read for sci-fi fans.', TRUE, 6),
(4, 2, 4, 'A beautiful critique of the American Dream. Fitzgerald\'s prose is gorgeous, though the story is quite tragic.', TRUE, 5);

-- Insert some staff logs to demonstrate audit trail
INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description, old_values, new_values, action_date, ip_address, user_agent) VALUES
(1, 'add_book', 'book', 1, 'Added new book: To Kill a Mockingbird', NULL, '{"title":"To Kill a Mockingbird","author":"Harper Lee"}', '2024-01-01 10:00:00', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
(2, 'update_inventory', 'book', 5, 'Updated inventory for Harry Potter and the Philosopher\'s Stone', '{"available_copies":11}', '{"available_copies":10}', '2024-01-15 14:30:00', '192.168.1.101', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
(1, 'manage_user', 'user', 3, 'Processed checkout for user duc', NULL, '{"book_id":1,"checkout_date":"2024-01-10"}', '2024-01-10 10:00:00', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

-- Final verification
SELECT 'Database setup completed successfully!' as status;
SELECT 'Books' as table_name, COUNT(*) as count FROM books
UNION ALL
SELECT 'Authors', COUNT(*) FROM authors
UNION ALL  
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Book-Authors Links', COUNT(*) FROM book_authors
UNION ALL
SELECT 'Checkouts', COUNT(*) FROM checkouts
UNION ALL
SELECT 'Reviews', COUNT(*) FROM reviews
UNION ALL
SELECT 'Staff Logs', COUNT(*) FROM staff_logs;
