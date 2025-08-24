-- Smart Library Platform - MySQL Stored Procedures
USE smart_library;

-- Drop procedures if they exist
DROP PROCEDURE IF EXISTS BorrowBook;
DROP PROCEDURE IF EXISTS ReturnBook;
DROP PROCEDURE IF EXISTS ReviewBook;
DROP PROCEDURE IF EXISTS AddBook;
DROP PROCEDURE IF EXISTS UpdateInventory;
DROP PROCEDURE IF EXISTS RetireBook;

-- Change delimiter to handle procedure definitions
DELIMITER //

-- Procedure 1: Borrow a Book
CREATE PROCEDURE BorrowBook(
    IN p_user_id INT,
    IN p_book_id INT,
    IN p_staff_id INT,
    IN p_loan_period_days INT,
    OUT p_result VARCHAR(255),
    OUT p_checkout_id INT
)
BEGIN
    DECLARE v_available_copies INT DEFAULT 0;
    DECLARE v_is_active BOOLEAN DEFAULT FALSE;
    DECLARE v_user_active_checkouts INT DEFAULT 0;
    DECLARE v_user_exists BOOLEAN DEFAULT FALSE;
    DECLARE v_book_exists BOOLEAN DEFAULT FALSE;
    DECLARE v_due_date DATE;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'Error: Transaction failed due to database error';
        SET p_checkout_id = -1;
    END;
    
    -- Start transaction
    START TRANSACTION;
    
    -- Check if user exists and is active
    SELECT COUNT(*) INTO v_user_exists 
    FROM users 
    WHERE user_id = p_user_id AND is_active = TRUE;
    
    IF v_user_exists = 0 THEN
        SET p_result = 'Error: User not found or inactive';
        SET p_checkout_id = -1;
        ROLLBACK;
    ELSE
        -- Check if book exists and get availability with row lock
        SELECT available_copies, is_active INTO v_available_copies, v_is_active
        FROM books 
        WHERE book_id = p_book_id 
        FOR UPDATE;
        
        SELECT COUNT(*) INTO v_book_exists 
        FROM books 
        WHERE book_id = p_book_id;
        
        IF v_book_exists = 0 THEN
            SET p_result = 'Error: Book not found';
            SET p_checkout_id = -1;
            ROLLBACK;
        ELSEIF v_is_active = FALSE THEN
            SET p_result = 'Error: Book is not active';
            SET p_checkout_id = -1;
            ROLLBACK;
        ELSEIF v_available_copies <= 0 THEN
            SET p_result = 'Error: Book not available';
            SET p_checkout_id = -1;
            ROLLBACK;
        ELSE
            -- Check user's current active checkouts
            SELECT COUNT(*) INTO v_user_active_checkouts
            FROM checkouts 
            WHERE user_id = p_user_id AND is_returned = FALSE;
            
            IF v_user_active_checkouts >= 5 THEN
                SET p_result = 'Error: User has reached maximum checkout limit (5 books)';
                SET p_checkout_id = -1;
                ROLLBACK;
            ELSE
                -- Calculate due date
                SET v_due_date = DATE_ADD(CURDATE(), INTERVAL p_loan_period_days DAY);
                
                -- Create checkout record
                INSERT INTO checkouts (user_id, book_id, due_date, staff_checkout_id)
                VALUES (p_user_id, p_book_id, v_due_date, p_staff_id);
                
                SET p_checkout_id = LAST_INSERT_ID();
                
                -- Update book availability
                UPDATE books 
                SET available_copies = available_copies - 1,
                    total_borrowed = total_borrowed + 1
                WHERE book_id = p_book_id;
                
                -- Log staff action
                INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description)
                VALUES (p_staff_id, 'add_book', 'book', p_book_id, 
                       CONCAT('Book borrowed by user ', p_user_id, ', checkout ID: ', p_checkout_id));
                
                SET p_result = 'Success: Book borrowed successfully';
                COMMIT;
            END IF;
        END IF;
    END IF;
END//

-- Procedure 2: Return a Book
CREATE PROCEDURE ReturnBook(
    IN p_checkout_id INT,
    IN p_staff_id INT,
    OUT p_result VARCHAR(255),
    OUT p_late_fee DECIMAL(10,2)
)
BEGIN
    DECLARE v_book_id INT;
    DECLARE v_user_id INT;
    DECLARE v_due_date DATE;
    DECLARE v_is_returned BOOLEAN DEFAULT FALSE;
    DECLARE v_checkout_exists BOOLEAN DEFAULT FALSE;
    DECLARE v_days_late INT DEFAULT 0;
    DECLARE v_fee_per_day DECIMAL(10,2) DEFAULT 1.00;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'Error: Transaction failed due to database error';
        SET p_late_fee = 0.00;
    END;
    
    -- Start transaction
    START TRANSACTION;
    
    -- Check if checkout exists and get details
    SELECT book_id, user_id, due_date, is_returned INTO v_book_id, v_user_id, v_due_date, v_is_returned
    FROM checkouts 
    WHERE checkout_id = p_checkout_id;
    
    SELECT COUNT(*) INTO v_checkout_exists 
    FROM checkouts 
    WHERE checkout_id = p_checkout_id;
    
    IF v_checkout_exists = 0 THEN
        SET p_result = 'Error: Checkout record not found';
        SET p_late_fee = 0.00;
        ROLLBACK;
    ELSEIF v_is_returned = TRUE THEN
        SET p_result = 'Error: Book already returned';
        SET p_late_fee = 0.00;
        ROLLBACK;
    ELSE
        -- Calculate late fee
        SET v_days_late = GREATEST(0, DATEDIFF(CURDATE(), v_due_date));
        SET p_late_fee = v_days_late * v_fee_per_day;
        
        -- Update checkout record
        UPDATE checkouts 
        SET return_date = CURRENT_TIMESTAMP,
            is_returned = TRUE,
            is_late = (v_days_late > 0),
            late_fee = p_late_fee,
            staff_return_id = p_staff_id
        WHERE checkout_id = p_checkout_id;
        
        -- Update book availability
        UPDATE books 
        SET available_copies = available_copies + 1
        WHERE book_id = v_book_id;
        
        -- Log staff action
        INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description)
        VALUES (p_staff_id, 'update_inventory', 'book', v_book_id, 
               CONCAT('Book returned, checkout ID: ', p_checkout_id, ', late fee: $', p_late_fee));
        
        SET p_result = 'Success: Book returned successfully';
        COMMIT;
    END IF;
END//

-- Procedure 3: Review a Book
CREATE PROCEDURE ReviewBook(
    IN p_user_id INT,
    IN p_book_id INT,
    IN p_rating INT,
    IN p_comment TEXT,
    OUT p_result VARCHAR(255),
    OUT p_review_id INT
)
BEGIN
    DECLARE v_user_exists BOOLEAN DEFAULT FALSE;
    DECLARE v_book_exists BOOLEAN DEFAULT FALSE;
    DECLARE v_has_borrowed BOOLEAN DEFAULT FALSE;
    DECLARE v_existing_review BOOLEAN DEFAULT FALSE;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'Error: Transaction failed due to database error';
        SET p_review_id = -1;
    END;
    
    -- Start transaction
    START TRANSACTION;
    
    -- Validate input
    IF p_rating < 1 OR p_rating > 5 THEN
        SET p_result = 'Error: Rating must be between 1 and 5';
        SET p_review_id = -1;
        ROLLBACK;
    ELSE
        -- Check if user exists
        SELECT COUNT(*) INTO v_user_exists 
        FROM users 
        WHERE user_id = p_user_id AND is_active = TRUE;
        
        -- Check if book exists
        SELECT COUNT(*) INTO v_book_exists 
        FROM books 
        WHERE book_id = p_book_id AND is_active = TRUE;
        
        -- Check if user has borrowed this book
        SELECT COUNT(*) INTO v_has_borrowed 
        FROM checkouts 
        WHERE user_id = p_user_id AND book_id = p_book_id;
        
        -- Check if user already reviewed this book
        SELECT COUNT(*) INTO v_existing_review 
        FROM reviews 
        WHERE user_id = p_user_id AND book_id = p_book_id;
        
        IF v_user_exists = 0 THEN
            SET p_result = 'Error: User not found or inactive';
            SET p_review_id = -1;
            ROLLBACK;
        ELSEIF v_book_exists = 0 THEN
            SET p_result = 'Error: Book not found or inactive';
            SET p_review_id = -1;
            ROLLBACK;
        ELSEIF v_has_borrowed = 0 THEN
            SET p_result = 'Error: User must borrow the book before reviewing';
            SET p_review_id = -1;
            ROLLBACK;
        ELSEIF v_existing_review > 0 THEN
            SET p_result = 'Error: User has already reviewed this book';
            SET p_review_id = -1;
            ROLLBACK;
        ELSE
            -- Insert review
            INSERT INTO reviews (user_id, book_id, rating, comment, is_verified)
            VALUES (p_user_id, p_book_id, p_rating, p_comment, TRUE);
            
            SET p_review_id = LAST_INSERT_ID();
            SET p_result = 'Success: Review added successfully';
            COMMIT;
        END IF;
    END IF;
END//

-- Procedure 4: Add a Book
CREATE PROCEDURE AddBook(
    IN p_title VARCHAR(200),
    IN p_isbn VARCHAR(20),
    IN p_publisher VARCHAR(100),
    IN p_publication_date DATE,
    IN p_genre VARCHAR(50),
    IN p_language VARCHAR(30),
    IN p_pages INT,
    IN p_description TEXT,
    IN p_total_copies INT,
    IN p_is_ebook BOOLEAN,
    IN p_cover_image_url VARCHAR(500),
    IN p_staff_id INT,
    OUT p_result VARCHAR(255),
    OUT p_book_id INT
)
BEGIN
    DECLARE v_isbn_exists BOOLEAN DEFAULT FALSE;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'Error: Transaction failed due to database error';
        SET p_book_id = -1;
    END;
    
    -- Start transaction
    START TRANSACTION;
    
    -- Check if ISBN already exists (if provided)
    IF p_isbn IS NOT NULL AND p_isbn != '' THEN
        SELECT COUNT(*) INTO v_isbn_exists 
        FROM books 
        WHERE isbn = p_isbn;
        
        IF v_isbn_exists > 0 THEN
            SET p_result = 'Error: Book with this ISBN already exists';
            SET p_book_id = -1;
            ROLLBACK;
        END IF;
    END IF;
    
    -- Validate input
    IF p_title IS NULL OR p_title = '' THEN
        SET p_result = 'Error: Title is required';
        SET p_book_id = -1;
        ROLLBACK;
    ELSEIF p_total_copies <= 0 THEN
        SET p_result = 'Error: Total copies must be greater than 0';
        SET p_book_id = -1;
        ROLLBACK;
    ELSE
        -- Insert new book
        INSERT INTO books (
            title, isbn, publisher, publication_date, genre, language, 
            pages, description, total_copies, available_copies, is_ebook, cover_image_url
        ) VALUES (
            p_title, p_isbn, p_publisher, p_publication_date, p_genre, p_language,
            p_pages, p_description, p_total_copies, p_total_copies, p_is_ebook, p_cover_image_url
        );
        
        SET p_book_id = LAST_INSERT_ID();
        
        -- Log staff action
        INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description, new_values)
        VALUES (p_staff_id, 'add_book', 'book', p_book_id, 
               CONCAT('New book added: ', p_title),
               JSON_OBJECT('title', p_title, 'isbn', p_isbn, 'total_copies', p_total_copies));
        
        SET p_result = 'Success: Book added successfully';
        COMMIT;
    END IF;
END//

-- Procedure 5: Update Inventory
CREATE PROCEDURE UpdateInventory(
    IN p_book_id INT,
    IN p_new_total_copies INT,
    IN p_staff_id INT,
    OUT p_result VARCHAR(255)
)
BEGIN
    DECLARE v_book_exists BOOLEAN DEFAULT FALSE;
    DECLARE v_current_total INT DEFAULT 0;
    DECLARE v_current_available INT DEFAULT 0;
    DECLARE v_checked_out INT DEFAULT 0;
    DECLARE v_new_available INT DEFAULT 0;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'Error: Transaction failed due to database error';
    END;
    
    -- Start transaction
    START TRANSACTION;
    
    -- Check if book exists and get current values
    SELECT COUNT(*) INTO v_book_exists 
    FROM books 
    WHERE book_id = p_book_id AND is_active = TRUE;
    
    SELECT total_copies, available_copies 
    INTO v_current_total, v_current_available
    FROM books 
    WHERE book_id = p_book_id;
    
    IF v_book_exists = 0 THEN
        SET p_result = 'Error: Book not found or inactive';
        ROLLBACK;
    ELSEIF p_new_total_copies <= 0 THEN
        SET p_result = 'Error: Total copies must be greater than 0';
        ROLLBACK;
    ELSE
        -- Calculate currently checked out copies
        SET v_checked_out = v_current_total - v_current_available;
        
        -- Calculate new available copies
        SET v_new_available = p_new_total_copies - v_checked_out;
        
        IF v_new_available < 0 THEN
            SET p_result = 'Error: Cannot reduce inventory below checked out copies';
            ROLLBACK;
        ELSE
            -- Update book inventory
            UPDATE books 
            SET total_copies = p_new_total_copies,
                available_copies = v_new_available
            WHERE book_id = p_book_id;
            
            -- Log staff action
            INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description, old_values, new_values)
            VALUES (p_staff_id, 'update_inventory', 'book', p_book_id, 
                   'Inventory updated',
                   JSON_OBJECT('total_copies', v_current_total, 'available_copies', v_current_available),
                   JSON_OBJECT('total_copies', p_new_total_copies, 'available_copies', v_new_available));
            
            SET p_result = 'Success: Inventory updated successfully';
            COMMIT;
        END IF;
    END IF;
END//

-- Procedure 6: Retire a Book
CREATE PROCEDURE RetireBook(
    IN p_book_id INT,
    IN p_staff_id INT,
    OUT p_result VARCHAR(255)
)
BEGIN
    DECLARE v_book_exists BOOLEAN DEFAULT FALSE;
    DECLARE v_checked_out_copies INT DEFAULT 0;
    DECLARE v_book_title VARCHAR(200);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_result = 'Error: Transaction failed due to database error';
    END;
    
    -- Start transaction
    START TRANSACTION;
    
    -- Check if book exists and is active
    SELECT COUNT(*) INTO v_book_exists 
    FROM books 
    WHERE book_id = p_book_id AND is_active = TRUE;
    
    SELECT title INTO v_book_title
    FROM books 
    WHERE book_id = p_book_id;
    
    -- Check for active checkouts
    SELECT COUNT(*) INTO v_checked_out_copies
    FROM checkouts 
    WHERE book_id = p_book_id AND is_returned = FALSE;
    
    IF v_book_exists = 0 THEN
        SET p_result = 'Error: Book not found or already retired';
        ROLLBACK;
    ELSEIF v_checked_out_copies > 0 THEN
        SET p_result = 'Error: Cannot retire book with active checkouts';
        ROLLBACK;
    ELSE
        -- Retire the book (set as inactive)
        UPDATE books 
        SET is_active = FALSE,
            available_copies = 0
        WHERE book_id = p_book_id;
        
        -- Log staff action
        INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description)
        VALUES (p_staff_id, 'retire_book', 'book', p_book_id, 
               CONCAT('Book retired: ', v_book_title));
        
        SET p_result = 'Success: Book retired successfully';
        COMMIT;
    END IF;
END//

-- Restore default delimiter
DELIMITER ;

-- Example usage and testing
/*
-- Test borrow book
CALL BorrowBook(3, 1, 2, 14, @result, @checkout_id);
SELECT @result as borrow_result, @checkout_id as checkout_id;

-- Test return book
CALL ReturnBook(@checkout_id, 2, @return_result, @late_fee);
SELECT @return_result as return_result, @late_fee as late_fee;

-- Test review book
CALL ReviewBook(3, 1, 5, 'Excellent book!', @review_result, @review_id);
SELECT @review_result as review_result, @review_id as review_id;
*/
