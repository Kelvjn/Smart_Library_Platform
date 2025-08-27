-- Smart Library Platform Database Schema
-- MySQL Database Setup

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

-- Users table (both readers and staff)
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

-- Authors table
CREATE TABLE authors (
    author_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Books table
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

-- Checkouts table
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

-- Reviews table
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

-- Staff logs table
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
CREATE INDEX idx_authors_name ON authors(name);

-- Report optimization
CREATE INDEX idx_checkouts_date_range ON checkouts(checkout_date, is_returned);
CREATE INDEX idx_books_borrowed_count ON books(total_borrowed DESC);
CREATE INDEX idx_users_type_active ON users(user_type, is_active);

-- Composite indexes for complex queries
CREATE INDEX idx_book_search_composite ON books(is_active, genre, title);
CREATE INDEX idx_checkout_analytics ON checkouts(book_id, checkout_date, is_returned);

-- Full-text search index for book search
ALTER TABLE books ADD FULLTEXT(title, description);
ALTER TABLE authors ADD FULLTEXT(name);

-- Insert sample data for testing
-- Sample users
INSERT INTO users (username, email, password_hash, first_name, last_name, user_type) VALUES
('admin', 'admin@library.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 'admin'),
('librarian1', 'librarian1@library.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Jane', 'Smith', 'staff'),
('reader1', 'reader1@library.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'John', 'Doe', 'reader'),
('reader2', 'reader2@library.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Alice', 'Johnson', 'reader');

-- Sample authors
INSERT INTO authors (name) VALUES
('George Orwell'),
('Jane Austen'),
('Mark Twain'),
('Virginia Woolf'),
('Ernest Hemingway');

-- Sample books
INSERT INTO books (title, isbn, publisher, publication_date, genre, pages, description, total_copies, available_copies, is_ebook) VALUES
('1984', '978-0-452-28423-4', 'Plume', '1949-06-08', 'Dystopian Fiction', 328, 'A dystopian social science fiction novel', 5, 5, TRUE),
('Pride and Prejudice', '978-0-14-143951-8', 'Penguin Classics', '1813-01-28', 'Romance', 432, 'A romantic novel of manners', 3, 3, TRUE),
('The Adventures of Tom Sawyer', '978-0-14-036982-2', 'Penguin Classics', '1876-01-01', 'Adventure', 244, 'A novel about a young boy growing up along the Mississippi River', 4, 4, FALSE),
('To the Lighthouse', '978-0-15-690739-5', 'Harcourt Brace', '1927-05-05', 'Modernist', 209, 'A landmark novel of high modernism', 2, 2, TRUE),
('The Old Man and the Sea', '978-0-684-80122-3', 'Scribner', '1952-09-01', 'Literary Fiction', 127, 'The story of an aging Cuban fisherman', 3, 3, TRUE);

-- Link books to authors
INSERT INTO book_authors (book_id, author_id, author_order) VALUES
(1, 1, 1), -- 1984 by George Orwell
(2, 2, 1), -- Pride and Prejudice by Jane Austen
(3, 3, 1), -- Tom Sawyer by Mark Twain
(4, 4, 1), -- To the Lighthouse by Virginia Woolf
(5, 5, 1); -- The Old Man and the Sea by Ernest Hemingway
