-- ============================================================================
-- DBMS Course Project: Library Circulation & Digital Resource Management System
-- Student: Rohan Shikhar (Roll No: 25WU0101112)
-- Section: AIML Whales | Institution: Woxsen University
-- Target Engine: MySQL 9.7 (Normalized 3NF Relational Architecture)
-- ============================================================================

DROP DATABASE IF EXISTS LibraryDBMS;
CREATE DATABASE LibraryDBMS;
USE LibraryDBMS;

-- ============================================================================
-- 1. DDL: TABLE DEFINITIONS (13 RELATIONAL TABLES IN 3NF)
-- ============================================================================

-- Table 1: CATEGORY (Master subject classifications)
CREATE TABLE CATEGORY (
    CategoryID INT PRIMARY KEY AUTO_INCREMENT,
    CategoryName VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- Table 2: PUBLISHER (Book publishers)
CREATE TABLE PUBLISHER (
    PublisherID INT PRIMARY KEY AUTO_INCREMENT,
    PublisherName VARCHAR(150) NOT NULL UNIQUE,
    City VARCHAR(100)
) ENGINE=InnoDB;

-- Table 3: AUTHOR (Book authors)
CREATE TABLE AUTHOR (
    AuthorID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(150) NOT NULL,
    Country VARCHAR(100)
) ENGINE=InnoDB;

-- Table 4: BOOK (Unique title catalog entity)
CREATE TABLE BOOK (
    BookID INT PRIMARY KEY,
    ISBN VARCHAR(20) NOT NULL UNIQUE,
    Title VARCHAR(200) NOT NULL,
    CategoryID INT NOT NULL,
    PublisherID INT NOT NULL,
    CONSTRAINT fk_book_category FOREIGN KEY (CategoryID) REFERENCES CATEGORY(CategoryID) ON UPDATE CASCADE,
    CONSTRAINT fk_book_publisher FOREIGN KEY (PublisherID) REFERENCES PUBLISHER(PublisherID) ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Table 5: BOOK_AUTHOR (M:N junction between Book and Author)
CREATE TABLE BOOK_AUTHOR (
    BookID INT NOT NULL,
    AuthorID INT NOT NULL,
    PRIMARY KEY (BookID, AuthorID),
    CONSTRAINT fk_ba_book FOREIGN KEY (BookID) REFERENCES BOOK(BookID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ba_author FOREIGN KEY (AuthorID) REFERENCES AUTHOR(AuthorID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Table 6: COPY (Individual physical copies on the shelf)
CREATE TABLE COPY (
    CopyID INT PRIMARY KEY AUTO_INCREMENT,
    AccessionNo VARCHAR(50) NOT NULL UNIQUE,
    BookID INT NOT NULL,
    Status ENUM('Available', 'Issued', 'Reserved', 'Lost') DEFAULT 'Available',
    CONSTRAINT fk_copy_book FOREIGN KEY (BookID) REFERENCES BOOK(BookID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Table 7: MEMBER (Registered students and faculty)
CREATE TABLE MEMBER (
    MemberID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(150) NOT NULL,
    Email VARCHAR(150) NOT NULL UNIQUE,
    MemberType VARCHAR(50) NOT NULL DEFAULT 'Student'
) ENGINE=InnoDB;

-- Table 8: ISSUE (Circulation transactions)
CREATE TABLE ISSUE (
    IssueID INT PRIMARY KEY AUTO_INCREMENT,
    MemberID INT NOT NULL,
    CopyID INT NOT NULL,
    IssueDate DATE NOT NULL,
    DueDate DATE NOT NULL,
    CONSTRAINT fk_issue_member FOREIGN KEY (MemberID) REFERENCES MEMBER(MemberID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_issue_copy FOREIGN KEY (CopyID) REFERENCES COPY(CopyID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Table 9: RETURN (Closes an active issue)
CREATE TABLE `RETURN` (
    ReturnID INT PRIMARY KEY AUTO_INCREMENT,
    IssueID INT NOT NULL UNIQUE,
    ReturnDate DATE NOT NULL,
    CONSTRAINT fk_return_issue FOREIGN KEY (IssueID) REFERENCES ISSUE(IssueID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Table 10: RESERVATION (Waiting list queue for popular titles)
CREATE TABLE RESERVATION (
    ReservationID INT PRIMARY KEY AUTO_INCREMENT,
    MemberID INT NOT NULL,
    BookID INT NOT NULL,
    ReservationDate DATE NOT NULL,
    QueueNo INT DEFAULT 1,
    Status VARCHAR(50) DEFAULT 'Pending',
    CONSTRAINT fk_res_member FOREIGN KEY (MemberID) REFERENCES MEMBER(MemberID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_res_book FOREIGN KEY (BookID) REFERENCES BOOK(BookID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Table 11: FINE (Overdue late fee charges)
CREATE TABLE FINE (
    FineID INT PRIMARY KEY AUTO_INCREMENT,
    IssueID INT NOT NULL UNIQUE,
    Amount DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    PaidStatus ENUM('Paid', 'Unpaid') DEFAULT 'Unpaid',
    CONSTRAINT fk_fine_issue FOREIGN KEY (IssueID) REFERENCES ISSUE(IssueID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Table 12: DIGITAL_RESOURCE (E-books and digital journals)
CREATE TABLE DIGITAL_RESOURCE (
    ResourceID INT PRIMARY KEY AUTO_INCREMENT,
    Title VARCHAR(200) NOT NULL,
    Format VARCHAR(50) NOT NULL,
    AccessURL VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

-- Table 13: DIGITAL_ACCESS_LOG (Access audit log for digital materials)
CREATE TABLE DIGITAL_ACCESS_LOG (
    LogID INT PRIMARY KEY AUTO_INCREMENT,
    MemberID INT NOT NULL,
    ResourceID INT NOT NULL,
    AccessDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_log_member FOREIGN KEY (MemberID) REFERENCES MEMBER(MemberID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_log_resource FOREIGN KEY (ResourceID) REFERENCES DIGITAL_RESOURCE(ResourceID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- 2. DML: SEED DATA (EXACT DATA AS GIVEN IN PORTAL)
-- ============================================================================

-- Categories
INSERT INTO CATEGORY (CategoryID, CategoryName) VALUES
(1, 'DBMS'),
(2, 'OS'),
(3, 'Networking'),
(4, 'Programming'),
(5, 'DSA'),
(6, 'AI'),
(7, 'Cloud'),
(8, 'SE'),
(9, 'Web Dev'),
(10, 'Security'),
(11, 'IoT'),
(12, 'Data Science'),
(13, 'Graphics'),
(14, 'Compiler');

-- Publishers
INSERT INTO PUBLISHER (PublisherID, PublisherName, City) VALUES
(1, 'McGraw Hill', 'New York'),
(2, 'Wiley', 'Hoboken'),
(3, 'Pearson', 'London'),
(4, 'O Reilly Media', 'Sebastopol'),
(5, 'MIT Press', 'Cambridge'),
(6, 'Cengage', 'Boston');

-- Authors
INSERT INTO AUTHOR (AuthorID, Name, Country) VALUES
(1, 'Korth', 'USA'),
(2, 'Galvin', 'USA'),
(3, 'Forouzan', 'USA'),
(4, 'Herbert Schildt', 'USA'),
(5, 'John Zelle', 'USA'),
(6, 'Karumanchi', 'India'),
(7, 'Russell', 'USA'),
(8, 'Tom Mitchell', 'USA'),
(9, 'Buyya', 'Australia'),
(10, 'Pressman', 'USA'),
(11, 'Maximilian', 'Germany'),
(12, 'Ethan Brown', 'USA'),
(13, 'Dennis Ritchie', 'USA'),
(14, 'Han Kamber', 'USA'),
(15, 'William Stallings', 'USA'),
(16, 'David Hanes', 'USA'),
(17, 'Seema Acharya', 'India'),
(18, 'Ian Goodfellow', 'Canada'),
(19, 'Hearn', 'USA'),
(20, 'Aho', 'USA');

-- Books (20 exact titles from Portal)
INSERT INTO BOOK (BookID, ISBN, Title, CategoryID, PublisherID) VALUES
(201, '978-0073523323', 'Database Management System', 1, 1),
(202, '978-1118063330', 'Operating Systems', 2, 2),
(203, '978-0073376226', 'Computer Networks', 3, 1),
(204, '978-1260440232', 'Java Programming', 4, 1),
(205, '978-1590282755', 'Python Basics', 4, 6),
(206, '978-8193245279', 'Data Structures', 5, 6),
(207, '978-0136042594', 'Artificial Intelligence', 6, 3),
(208, '978-0070428072', 'Machine Learning', 6, 1),
(209, '978-0128014134', 'Cloud Computing', 7, 2),
(210, '978-0078022128', 'Software Engineering', 8, 1),
(211, '978-1801070140', 'React Development', 9, 4),
(212, '978-1491942437', 'Node.js Guide', 9, 4),
(213, '978-0131103627', 'C Programming', 4, 3),
(214, '978-0123814791', 'Data Mining', 6, 2),
(215, '978-0134772806', 'Cyber Security', 10, 3),
(216, '978-1587144561', 'IoT Fundamentals', 11, 3),
(217, '978-8126565580', 'Big Data Analytics', 12, 2),
(218, '978-0262035613', 'Deep Learning', 6, 5),
(219, '978-0136053583', 'Computer Graphics', 13, 3),
(220, '978-0321486813', 'Compiler Design', 14, 3);

-- Link Books to Authors
INSERT INTO BOOK_AUTHOR (BookID, AuthorID) VALUES
(201, 1), (202, 2), (203, 3), (204, 4), (205, 5),
(206, 6), (207, 7), (208, 8), (209, 9), (210, 10),
(211, 11), (212, 12), (213, 13), (214, 14), (215, 15),
(216, 16), (217, 17), (218, 18), (219, 19), (220, 20);

-- Physical Copies for shelf availability
INSERT INTO COPY (CopyID, AccessionNo, BookID, Status) VALUES
-- Book 201: 5 copies (ACC-201-1 to ACC-201-5)
(1, 'ACC-201-1', 201, 'Issued'),
(2, 'ACC-201-2', 201, 'Available'),
(3, 'ACC-201-3', 201, 'Available'),
(4, 'ACC-201-4', 201, 'Available'),
(5, 'ACC-201-5', 201, 'Available'),
(6, 'ACC-201-6', 201, 'Available'),
-- Book 202: 4 copies
(7, 'ACC-202-1', 202, 'Available'),
(8, 'ACC-202-2', 202, 'Available'),
(9, 'ACC-202-3', 202, 'Available'),
(10, 'ACC-202-4', 202, 'Available'),
-- Book 203: 6 copies
(11, 'ACC-203-1', 203, 'Available'),
(12, 'ACC-203-2', 203, 'Available'),
(13, 'ACC-203-3', 203, 'Available'),
(14, 'ACC-203-4', 203, 'Available'),
(15, 'ACC-203-5', 203, 'Available'),
(16, 'ACC-203-6', 203, 'Available'),
-- Book 204: 7 copies
(17, 'ACC-204-1', 204, 'Available'),
(18, 'ACC-204-2', 204, 'Available'),
(19, 'ACC-204-3', 204, 'Available'),
(20, 'ACC-204-4', 204, 'Available'),
(21, 'ACC-204-5', 204, 'Available'),
(22, 'ACC-204-6', 204, 'Available'),
(23, 'ACC-204-7', 204, 'Available'),
-- Book 205: 8 copies
(24, 'ACC-205-1', 205, 'Issued'),
(25, 'ACC-205-2', 205, 'Available'),
(26, 'ACC-205-3', 205, 'Available'),
(27, 'ACC-205-4', 205, 'Available'),
(28, 'ACC-205-5', 205, 'Available'),
(29, 'ACC-205-6', 205, 'Available'),
(30, 'ACC-205-7', 205, 'Available'),
(31, 'ACC-205-8', 205, 'Available'),
(32, 'ACC-205-9', 205, 'Available'),
-- Book 206: 5 copies
(33, 'ACC-206-1', 206, 'Available'),
(34, 'ACC-206-2', 206, 'Available'),
(35, 'ACC-206-3', 206, 'Available'),
(36, 'ACC-206-4', 206, 'Available'),
(37, 'ACC-206-5', 206, 'Available'),
-- Book 207: 3 copies
(38, 'ACC-207-1', 207, 'Issued'),
(39, 'ACC-207-2', 207, 'Available'),
(40, 'ACC-207-3', 207, 'Available'),
(41, 'ACC-207-4', 207, 'Available'),
-- Book 208: 4 copies
(42, 'ACC-208-1', 208, 'Issued'),
(43, 'ACC-208-2', 208, 'Available'),
(44, 'ACC-208-3', 208, 'Available'),
(45, 'ACC-208-4', 208, 'Available'),
(46, 'ACC-208-5', 208, 'Available'),
-- Book 209: 5 copies
(47, 'ACC-209-1', 209, 'Available'),
(48, 'ACC-209-2', 209, 'Available'),
(49, 'ACC-209-3', 209, 'Available'),
(50, 'ACC-209-4', 209, 'Available'),
(51, 'ACC-209-5', 209, 'Available'),
-- Book 210: 6 copies
(52, 'ACC-210-1', 210, 'Available'),
(53, 'ACC-210-2', 210, 'Available'),
(54, 'ACC-210-3', 210, 'Available'),
(55, 'ACC-210-4', 210, 'Available'),
(56, 'ACC-210-5', 210, 'Available'),
(57, 'ACC-210-6', 210, 'Available'),
-- Book 211: 4 copies
(58, 'ACC-211-1', 211, 'Available'),
(59, 'ACC-211-2', 211, 'Available'),
(60, 'ACC-211-3', 211, 'Available'),
(61, 'ACC-211-4', 211, 'Available'),
-- Book 212: 3 copies
(62, 'ACC-212-1', 212, 'Available'),
(63, 'ACC-212-2', 212, 'Available'),
(64, 'ACC-212-3', 212, 'Available'),
-- Book 213: 6 copies
(65, 'ACC-213-1', 213, 'Available'),
(66, 'ACC-213-2', 213, 'Available'),
(67, 'ACC-213-3', 213, 'Available'),
(68, 'ACC-213-4', 213, 'Available'),
(69, 'ACC-213-5', 213, 'Available'),
(70, 'ACC-213-6', 213, 'Available'),
-- Book 214: 4 copies
(71, 'ACC-214-1', 214, 'Issued'),
(72, 'ACC-214-2', 214, 'Available'),
(73, 'ACC-214-3', 214, 'Available'),
(74, 'ACC-214-4', 214, 'Available'),
(75, 'ACC-214-5', 214, 'Available'),
-- Book 215: 5 copies
(76, 'ACC-215-1', 215, 'Available'),
(77, 'ACC-215-2', 215, 'Available'),
(78, 'ACC-215-3', 215, 'Available'),
(79, 'ACC-215-4', 215, 'Available'),
(80, 'ACC-215-5', 215, 'Available'),
-- Book 216: 5 copies
(81, 'ACC-216-1', 216, 'Issued'),
(82, 'ACC-216-2', 216, 'Available'),
(83, 'ACC-216-3', 216, 'Available'),
(84, 'ACC-216-4', 216, 'Available'),
(85, 'ACC-216-5', 216, 'Available'),
(86, 'ACC-216-6', 216, 'Available'),
-- Book 217: 4 copies
(87, 'ACC-217-1', 217, 'Available'),
(88, 'ACC-217-2', 217, 'Available'),
(89, 'ACC-217-3', 217, 'Available'),
(90, 'ACC-217-4', 217, 'Available'),
-- Book 218: 3 copies
(91, 'ACC-218-1', 218, 'Available'),
(92, 'ACC-218-2', 218, 'Available'),
(93, 'ACC-218-3', 218, 'Available'),
-- Book 219: 4 copies
(94, 'ACC-219-1', 219, 'Available'),
(95, 'ACC-219-2', 219, 'Available'),
(96, 'ACC-219-3', 219, 'Available'),
(97, 'ACC-219-4', 219, 'Available'),
-- Book 220: 5 copies
(98, 'ACC-220-1', 220, 'Available'),
(99, 'ACC-220-2', 220, 'Available'),
(100, 'ACC-220-3', 220, 'Available'),
(101, 'ACC-220-4', 220, 'Available'),
(102, 'ACC-220-5', 220, 'Available');

-- Members (10 exact patrons from Portal)
INSERT INTO MEMBER (MemberID, Name, Email, MemberType) VALUES
(1, 'Rohan Shikhar', 'rohan.shikhar@woxsen.edu.in', 'Student'),
(2, 'Sarthak Sharma', 'sarthak.sharma@woxsen.edu.in', 'Student'),
(3, 'Soumya Singh', 'soumya.singh@woxsen.edu.in', 'Student'),
(4, 'Shreshtha Gupta', 'shreshtha.gupta@woxsen.edu.in', 'Student'),
(5, 'Aman Verma', 'aman.verma@woxsen.edu.in', 'Student'),
(6, 'Priya Patel', 'priya.patel@woxsen.edu.in', 'Student'),
(7, 'Rahul Kumar', 'rahul.kumar@woxsen.edu.in', 'Student'),
(8, 'Sneha Reddy', 'sneha.reddy@woxsen.edu.in', 'Student'),
(9, 'Arjun Mehta', 'arjun.mehta@woxsen.edu.in', 'Student'),
(10, 'Ananya Jain', 'ananya.jain@woxsen.edu.in', 'Student');

-- Issues (10 issues from Portal)
INSERT INTO ISSUE (IssueID, MemberID, CopyID, IssueDate, DueDate) VALUES
(1, 1, 1, '2025-09-01', '2025-09-15'),
(2, 2, 7, '2025-09-02', '2025-09-16'),
(3, 3, 38, '2025-09-03', '2025-09-17'),
(4, 4, 17, '2025-09-04', '2025-09-18'),
(5, 5, 42, '2025-09-05', '2025-09-19'),
(6, 6, 47, '2025-09-06', '2025-09-20'),
(7, 7, 24, '2025-09-07', '2025-09-21'),
(8, 8, 52, '2025-09-08', '2025-09-22'),
(9, 9, 71, '2025-09-09', '2025-09-23'),
(10, 10, 81, '2025-09-10', '2025-09-24');

-- Returns (Returned issues: Issue 2, 4, 6, 8)
INSERT INTO `RETURN` (ReturnID, IssueID, ReturnDate) VALUES
(1, 2, '2025-09-18'),
(2, 4, '2025-09-19'),
(3, 6, '2025-09-25'),
(4, 8, '2025-09-23');

-- Overdue Fines (Matching Query 5 exactly)
INSERT INTO FINE (FineID, IssueID, Amount, PaidStatus) VALUES
(1, 1, 50.00, 'Unpaid'),
(2, 3, 25.00, 'Unpaid'),
(3, 5, 15.00, 'Unpaid'),
(4, 7, 10.00, 'Unpaid'),
(5, 9, 10.00, 'Unpaid');

-- Digital Resources (E-Books & Journals)
INSERT INTO DIGITAL_RESOURCE (ResourceID, Title, Format, AccessURL) VALUES
(1, 'Database System Concepts (8th Ed) E-Book', 'PDF', 'https://library.woxsen.edu.in/ebooks/dbms-korth.pdf'),
(2, 'IEEE Transactions on Knowledge & Data Engineering', 'Journal', 'https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=69'),
(3, 'Deep Learning Foundations by Goodfellow', 'PDF', 'https://library.woxsen.edu.in/ebooks/deeplearning.pdf'),
(4, 'ACM Transactions on Database Systems', 'Journal', 'https://dl.acm.org/journal/tods');

-- Digital Access Log
INSERT INTO DIGITAL_ACCESS_LOG (LogID, MemberID, ResourceID, AccessDate) VALUES
(1, 1, 1, '2025-09-12 10:15:00'),
(2, 3, 3, '2025-09-14 14:30:00'),
(3, 1, 2, '2025-09-15 09:45:00'),
(4, 5, 4, '2025-09-16 16:20:00');

-- ============================================================================
-- 3. ALIAS VIEWS (FOR PORTAL SLIDE COMPATIBILITY)
-- ============================================================================

-- View: Books (Provides Title, Author, Category, and Available_Copies count)
CREATE OR REPLACE VIEW Books AS
SELECT 
    b.BookID AS Book_ID,
    b.Title,
    a.Name AS Author,
    c.CategoryName AS Category,
    COUNT(CASE WHEN cp.Status = 'Available' THEN 1 END) AS Available_Copies
FROM BOOK b
JOIN CATEGORY c ON b.CategoryID = c.CategoryID
LEFT JOIN BOOK_AUTHOR ba ON b.BookID = ba.BookID
LEFT JOIN AUTHOR a ON ba.AuthorID = a.AuthorID
LEFT JOIN COPY cp ON b.BookID = cp.BookID
GROUP BY b.BookID, b.Title, a.Name, c.CategoryName;

-- View: Members
CREATE OR REPLACE VIEW Members AS
SELECT 
    MemberID AS Member_ID,
    Name AS Member_Name,
    Email,
    MemberType AS Member_Type
FROM MEMBER;

-- View: Issued_Books
CREATE OR REPLACE VIEW Issued_Books AS
SELECT 
    i.IssueID AS Issue_ID,
    i.MemberID AS Member_ID,
    cp.BookID AS Book_ID,
    i.CopyID AS Copy_ID,
    i.IssueDate AS Issue_Date,
    i.DueDate AS Due_Date,
    r.ReturnDate AS Return_Date
FROM ISSUE i
JOIN COPY cp ON i.CopyID = cp.CopyID
LEFT JOIN `RETURN` r ON i.IssueID = r.IssueID;

-- View: Fines
CREATE OR REPLACE VIEW Fines AS
SELECT 
    f.FineID AS Fine_ID,
    f.IssueID AS Issue_ID,
    f.Amount AS Fine_Amount,
    f.PaidStatus AS Paid_Status
FROM FINE f;

-- ============================================================================
-- 4. THE 5 EVALUATED QUERIES (AS PRESENTED IN PORTAL SLIDES)
-- ============================================================================

-- Query 1: Books available on the shelf
SELECT * 
FROM Books 
WHERE Available_Copies > 0;

-- Query 2: Who borrowed what, and when (Circulation tracking)
SELECT 
    m.Member_Name, 
    b.Title, 
    i.Issue_Date, 
    i.Return_Date
FROM Issued_Books i
JOIN Members m ON i.Member_ID = m.Member_ID
JOIN Books b ON i.Book_ID = b.Book_ID;

-- Query 3: Books past their due date (Overdue tracking)
SELECT 
    m.Member_Name, 
    b.Title, 
    i.Due_Date
FROM Issued_Books i
JOIN Members m ON i.Member_ID = m.Member_ID
JOIN Books b ON i.Book_ID = b.Book_ID
WHERE i.Return_Date IS NULL 
  AND i.Due_Date < CURDATE();

-- Query 4: How often each title is issued (Demand analysis)
SELECT 
    b.Title, 
    COUNT(*) AS Times_Issued
FROM Issued_Books i
JOIN Books b ON i.Book_ID = b.Book_ID
GROUP BY b.Book_ID, b.Title
ORDER BY Times_Issued DESC;

-- Query 5: Member fine summary & fees due (Financials)
SELECT 
    m.Member_Name, 
    m.Member_Type, 
    COUNT(i.Issue_ID) AS Total_Issued, 
    IFNULL(SUM(f.Fine_Amount), 0) AS Total_Fine
FROM Members m
LEFT JOIN Issued_Books i ON m.Member_ID = i.Member_ID
LEFT JOIN Fines f ON i.Issue_ID = f.Issue_ID
GROUP BY m.Member_ID, m.Member_Name, m.Member_Type
ORDER BY Total_Fine DESC;
