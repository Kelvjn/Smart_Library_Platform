-- Migration script to simplify authors table
-- Change from multiple columns to just author_id and name

USE smart_library;

-- Step 1: Create a backup of current authors data
CREATE TABLE authors_backup AS SELECT * FROM authors;

-- Step 2: Create new simplified authors table
CREATE TABLE authors_new (
    author_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Step 3: Migrate existing data (combine first_name and last_name)
INSERT INTO authors_new (author_id, name, created_at, updated_at)
SELECT 
    author_id,
    CONCAT(first_name, ' ', last_name) as name,
    created_at,
    updated_at
FROM authors
ORDER BY author_id;

-- Step 4: Drop the old authors table
DROP TABLE authors;

-- Step 5: Rename new table to authors
RENAME TABLE authors_new TO authors;

-- Step 6: Update indexes
CREATE INDEX idx_authors_name ON authors(name);
ALTER TABLE authors ADD FULLTEXT(name);

-- Step 7: Verify the migration
SELECT 'Migration completed successfully' as status;
SELECT COUNT(*) as total_authors FROM authors;
SELECT * FROM authors ORDER BY author_id;
