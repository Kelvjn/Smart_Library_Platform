-- Smart Library Platform - MySQL Functions
USE smart_library;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS IsBookAvailable;
DROP FUNCTION IF EXISTS IsReturnedOnTime;
DROP FUNCTION IF EXISTS CountBooksInDateRange;

-- Change delimiter to handle function definitions
DELIMITER //

-- Function 1: Check if a book is available for borrowing
CREATE FUNCTION IsBookAvailable(book_id_param INT)
RETURNS BOOLEAN
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE available_count INT DEFAULT 0;
    DECLARE is_active BOOLEAN DEFAULT FALSE;
    
    -- Check if book exists and is active, and get available copies
    SELECT b.available_copies, b.is_active 
    INTO available_count, is_active
    FROM books b 
    WHERE b.book_id = book_id_param;
    
    -- Return true if book is active and has available copies
    IF is_active = TRUE AND available_count > 0 THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END//

-- Function 2: Check if a book return is on time
CREATE FUNCTION IsReturnedOnTime(checkout_id_param INT)
RETURNS BOOLEAN
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE return_status BOOLEAN DEFAULT FALSE;
    DECLARE due_date_val DATE;
    DECLARE return_date_val TIMESTAMP;
    DECLARE is_returned_val BOOLEAN DEFAULT FALSE;
    
    -- Get checkout details
    SELECT due_date, return_date, is_returned
    INTO due_date_val, return_date_val, is_returned_val
    FROM checkouts 
    WHERE checkout_id = checkout_id_param;
    
    -- If not returned yet, check against current date
    IF is_returned_val = FALSE THEN
        IF CURDATE() <= due_date_val THEN
            SET return_status = TRUE;
        ELSE
            SET return_status = FALSE;
        END IF;
    ELSE
        -- If returned, check if return date was before or on due date
        IF DATE(return_date_val) <= due_date_val THEN
            SET return_status = TRUE;
        ELSE
            SET return_status = FALSE;
        END IF;
    END IF;
    
    RETURN return_status;
END//

-- Function 3: Calculate number of books borrowed in a given time range
CREATE FUNCTION CountBooksInDateRange(start_date DATE, end_date DATE)
RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE book_count INT DEFAULT 0;
    
    -- Count checkouts in the specified date range
    SELECT COUNT(*)
    INTO book_count
    FROM checkouts 
    WHERE DATE(checkout_date) BETWEEN start_date AND end_date;
    
    RETURN book_count;
END//

-- Additional helper function: Get overdue books count
CREATE FUNCTION GetOverdueBooksCount()
RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE overdue_count INT DEFAULT 0;
    
    -- Count books that are overdue (not returned and past due date)
    SELECT COUNT(*)
    INTO overdue_count
    FROM checkouts 
    WHERE is_returned = FALSE 
    AND due_date < CURDATE();
    
    RETURN overdue_count;
END//

-- Function to calculate late fee based on days overdue
CREATE FUNCTION CalculateLateFee(checkout_id_param INT, fee_per_day DECIMAL(10,2))
RETURNS DECIMAL(10,2)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE days_overdue INT DEFAULT 0;
    DECLARE total_fee DECIMAL(10,2) DEFAULT 0.00;
    DECLARE due_date_val DATE;
    DECLARE return_date_val TIMESTAMP;
    DECLARE is_returned_val BOOLEAN DEFAULT FALSE;
    
    -- Get checkout details
    SELECT due_date, return_date, is_returned
    INTO due_date_val, return_date_val, is_returned_val
    FROM checkouts 
    WHERE checkout_id = checkout_id_param;
    
    -- Calculate days overdue
    IF is_returned_val = TRUE THEN
        -- Use actual return date
        SET days_overdue = GREATEST(0, DATEDIFF(DATE(return_date_val), due_date_val));
    ELSE
        -- Use current date
        SET days_overdue = GREATEST(0, DATEDIFF(CURDATE(), due_date_val));
    END IF;
    
    -- Calculate total fee
    SET total_fee = days_overdue * fee_per_day;
    
    RETURN total_fee;
END//

-- Function to get user's active checkouts count
CREATE FUNCTION GetUserActiveCheckouts(user_id_param INT)
RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE active_count INT DEFAULT 0;
    
    SELECT COUNT(*)
    INTO active_count
    FROM checkouts 
    WHERE user_id = user_id_param 
    AND is_returned = FALSE;
    
    RETURN active_count;
END//

-- Function to check if user can borrow more books (max 5 books at a time)
CREATE FUNCTION CanUserBorrowMore(user_id_param INT, max_books INT)
RETURNS BOOLEAN
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE current_checkouts INT DEFAULT 0;
    
    SET current_checkouts = GetUserActiveCheckouts(user_id_param);
    
    IF current_checkouts < max_books THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END//

-- Function to get book popularity score based on checkouts and ratings
CREATE FUNCTION GetBookPopularityScore(book_id_param INT)
RETURNS DECIMAL(10,2)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE checkout_count INT DEFAULT 0;
    DECLARE avg_rating DECIMAL(3,2) DEFAULT 0;
    DECLARE popularity_score DECIMAL(10,2) DEFAULT 0;
    
    -- Get checkout count and average rating
    SELECT total_borrowed, average_rating
    INTO checkout_count, avg_rating
    FROM books 
    WHERE book_id = book_id_param;
    
    -- Calculate popularity score (weighted combination of checkouts and rating)
    SET popularity_score = (checkout_count * 0.7) + (avg_rating * 20 * 0.3);
    
    RETURN popularity_score;
END//

-- Restore default delimiter
DELIMITER ;

-- Test the functions with sample data
SELECT 
    'Function Tests' as test_section,
    IsBookAvailable(1) as book_1_available,
    CountBooksInDateRange('2024-01-01', CURDATE()) as books_borrowed_this_year,
    GetOverdueBooksCount() as overdue_books,
    CanUserBorrowMore(3, 5) as user_can_borrow_more;
