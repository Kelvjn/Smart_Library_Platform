PS D:\Github_Test\Smart_Library_Platform> & "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u li
brary_user -p"library_password" -e "USE smart_library; SELECT b.book_id, b.title, b.genre, b.publisher, b
.total_copies, b.available_copies FROM books b ORDER BY b.book_id;"

check data: node check-data.js

run: node server.js