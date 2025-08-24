-- Smart Library Platform - MySQL Triggers
USE smart_library;

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS after_checkout_insert;
DROP TRIGGER IF EXISTS after_checkout_update;
DROP TRIGGER IF EXISTS after_review_insert;
DROP TRIGGER IF EXISTS after_review_update;
DROP TRIGGER IF EXISTS after_review_delete;
DROP TRIGGER IF EXISTS before_book_update;

-- Change delimiter to handle trigger definitions
DELIMITER //

-- Trigger 1: After a book is borrowed (checkout inserted)
-- This trigger is supplementary to the stored procedure, ensuring data consistency
CREATE TRIGGER after_checkout_insert
AFTER INSERT ON checkouts
FOR EACH ROW
BEGIN
    -- Update book statistics if not already handled by stored procedure
    -- This provides a safety net for direct inserts
    IF NEW.is_returned = FALSE THEN
        UPDATE books 
        SET total_borrowed = total_borrowed + 1
        WHERE book_id = NEW.book_id 
        AND total_borrowed = total_borrowed; -- Only if not already incremented
    END IF;
END//

-- Trigger 2: After a book is returned (checkout updated)
-- Updates book metadata when return status changes
CREATE TRIGGER after_checkout_update
AFTER UPDATE ON checkouts
FOR EACH ROW
BEGIN
    -- When a book is marked as returned
    IF OLD.is_returned = FALSE AND NEW.is_returned = TRUE THEN
        -- Ensure available copies is updated (safety net)
        UPDATE books 
        SET available_copies = LEAST(total_copies, available_copies + 1)
        WHERE book_id = NEW.book_id;
        
        -- Update late return statistics if the return was late
        IF NEW.is_late = TRUE THEN
            -- Could add late return tracking to books table if needed
            -- UPDATE books SET late_returns = late_returns + 1 WHERE book_id = NEW.book_id;
            UPDATE books 
            SET updated_at = CURRENT_TIMESTAMP 
            WHERE book_id = NEW.book_id;
        END IF;
    END IF;
END//

-- Trigger 3: After a review is inserted
-- Updates book rating when a new review is added
CREATE TRIGGER after_review_insert
AFTER INSERT ON reviews
FOR EACH ROW
BEGIN
    DECLARE new_avg_rating DECIMAL(3,2);
    DECLARE review_count INT;
    
    -- Calculate new average rating and review count
    SELECT AVG(rating), COUNT(*) 
    INTO new_avg_rating, review_count
    FROM reviews 
    WHERE book_id = NEW.book_id;
    
    -- Update book's average rating and total reviews
    UPDATE books 
    SET average_rating = new_avg_rating,
        total_reviews = review_count,
        updated_at = CURRENT_TIMESTAMP
    WHERE book_id = NEW.book_id;
END//

-- Trigger 4: After a review is updated
-- Recalculates book rating when a review is modified
CREATE TRIGGER after_review_update
AFTER UPDATE ON reviews
FOR EACH ROW
BEGIN
    DECLARE new_avg_rating DECIMAL(3,2);
    DECLARE review_count INT;
    
    -- Only recalculate if rating changed
    IF OLD.rating != NEW.rating THEN
        -- Calculate new average rating and review count
        SELECT AVG(rating), COUNT(*) 
        INTO new_avg_rating, review_count
        FROM reviews 
        WHERE book_id = NEW.book_id;
        
        -- Update book's average rating
        UPDATE books 
        SET average_rating = new_avg_rating,
            updated_at = CURRENT_TIMESTAMP
        WHERE book_id = NEW.book_id;
    END IF;
END//

-- Trigger 5: After a review is deleted
-- Recalculates book rating when a review is removed
CREATE TRIGGER after_review_delete
AFTER DELETE ON reviews
FOR EACH ROW
BEGIN
    DECLARE new_avg_rating DECIMAL(3,2);
    DECLARE review_count INT;
    
    -- Calculate new average rating and review count
    SELECT COALESCE(AVG(rating), 0), COUNT(*) 
    INTO new_avg_rating, review_count
    FROM reviews 
    WHERE book_id = OLD.book_id;
    
    -- Update book's average rating and total reviews
    UPDATE books 
    SET average_rating = new_avg_rating,
        total_reviews = review_count,
        updated_at = CURRENT_TIMESTAMP
    WHERE book_id = OLD.book_id;
END//

-- Trigger 6: Before book update
-- Validates book data before updates and maintains data integrity
CREATE TRIGGER before_book_update
BEFORE UPDATE ON books
FOR EACH ROW
BEGIN
    -- Ensure available copies doesn't exceed total copies
    IF NEW.available_copies > NEW.total_copies THEN
        SET NEW.available_copies = NEW.total_copies;
    END IF;
    
    -- Ensure available copies is not negative
    IF NEW.available_copies < 0 THEN
        SET NEW.available_copies = 0;
    END IF;
    
    -- Ensure average rating is within valid range
    IF NEW.average_rating < 0 THEN
        SET NEW.average_rating = 0;
    ELSEIF NEW.average_rating > 5 THEN
        SET NEW.average_rating = 5;
    END IF;
    
    -- Ensure total borrowed count is not negative
    IF NEW.total_borrowed < 0 THEN
        SET NEW.total_borrowed = 0;
    END IF;
    
    -- Update the updated_at timestamp
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//

-- Additional trigger: Log significant book changes
CREATE TRIGGER after_book_significant_update
AFTER UPDATE ON books
FOR EACH ROW
BEGIN
    -- Log if total copies changed significantly (more than 10% change)
    IF ABS(NEW.total_copies - OLD.total_copies) >= GREATEST(1, OLD.total_copies * 0.1) THEN
        INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description, old_values, new_values)
        VALUES (
            1, -- System user ID for automated logs
            'update_inventory', 
            'book', 
            NEW.book_id,
            'Significant inventory change detected',
            JSON_OBJECT('total_copies', OLD.total_copies, 'available_copies', OLD.available_copies),
            JSON_OBJECT('total_copies', NEW.total_copies, 'available_copies', NEW.available_copies)
        );
    END IF;
    
    -- Log if book is deactivated
    IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
        INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description)
        VALUES (
            1, -- System user ID for automated logs
            'retire_book', 
            'book', 
            NEW.book_id,
            CONCAT('Book automatically deactivated: ', NEW.title)
        );
    END IF;
END//

-- Trigger for user audit trail
CREATE TRIGGER after_user_update
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    -- Log if user type changes
    IF OLD.user_type != NEW.user_type THEN
        INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description, old_values, new_values)
        VALUES (
            1, -- System user ID for automated logs
            'manage_user', 
            'user', 
            NEW.user_id,
            'User type changed',
            JSON_OBJECT('user_type', OLD.user_type, 'is_active', OLD.is_active),
            JSON_OBJECT('user_type', NEW.user_type, 'is_active', NEW.is_active)
        );
    END IF;
    
    -- Log if user is deactivated
    IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
        INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description)
        VALUES (
            1, -- System user ID for automated logs
            'manage_user', 
            'user', 
            NEW.user_id,
            CONCAT('User deactivated: ', NEW.username)
        );
    END IF;
END//

-- Restore default delimiter
DELIMITER ;

-- Test trigger functionality with sample data
/*
-- Test review trigger by inserting a review
INSERT INTO reviews (user_id, book_id, rating, comment) 
VALUES (3, 1, 5, 'Great book, highly recommend!');

-- Check if book rating was updated
SELECT book_id, title, average_rating, total_reviews 
FROM books 
WHERE book_id = 1;

-- Test checkout trigger by simulating a direct insert (not recommended in production)
-- This would normally be done through the stored procedure
*/

-- View to show trigger effectiveness
CREATE OR REPLACE VIEW book_statistics AS
SELECT 
    b.book_id,
    b.title,
    b.total_copies,
    b.available_copies,
    b.total_borrowed,
    b.average_rating,
    b.total_reviews,
    COUNT(c.checkout_id) as actual_checkouts,
    COUNT(r.review_id) as actual_reviews,
    AVG(r.rating) as calculated_avg_rating
FROM books b
LEFT JOIN checkouts c ON b.book_id = c.book_id
LEFT JOIN reviews r ON b.book_id = r.book_id
GROUP BY b.book_id, b.title, b.total_copies, b.available_copies, 
         b.total_borrowed, b.average_rating, b.total_reviews;
         
-- Query to verify trigger consistency
SELECT 
    book_id,
    title,
    total_reviews,
    actual_reviews,
    ROUND(average_rating, 2) as stored_rating,
    ROUND(calculated_avg_rating, 2) as calculated_rating,
    CASE 
        WHEN total_reviews = actual_reviews AND 
             ABS(average_rating - COALESCE(calculated_avg_rating, 0)) < 0.01 
        THEN 'CONSISTENT' 
        ELSE 'INCONSISTENT' 
    END as consistency_check
FROM book_statistics;
