import os
import datetime
from flask import Flask, render_template, request, jsonify
from config import Config
from db import get_connection, check_connection, init_database, query_db, modify_db

app = Flask(__name__)
app.config.from_object(Config)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/status', methods=['GET'])
def api_status():
    status_info = check_connection()
    stats = {}
    if status_info.get("status") == "connected" and status_info.get("database_exists"):
        try:
            b_count = query_db("SELECT COUNT(*) AS c FROM BOOK;", one=True)['c']
            c_count = query_db("SELECT COUNT(*) AS c FROM COPY;", one=True)['c']
            m_count = query_db("SELECT COUNT(*) AS c FROM MEMBER;", one=True)['c']
            i_count = query_db("SELECT COUNT(*) AS c FROM ISSUE i LEFT JOIN `RETURN` r ON i.IssueID = r.IssueID WHERE r.ReturnID IS NULL;", one=True)['c']
            f_total = query_db("SELECT IFNULL(SUM(Amount), 0) AS s FROM FINE WHERE PaidStatus = 'Unpaid';", one=True)['s']
            stats = {
                "total_books": b_count,
                "total_copies": c_count,
                "total_members": m_count,
                "active_loans": i_count,
                "unpaid_fines": float(f_total)
            }
        except Exception as e:
            stats = {"error": str(e)}
    return jsonify({
        "connection": status_info,
        "stats": stats
    })

@app.route('/api/config', methods=['POST'])
def api_config():
    data = request.json or {}
    if 'password' in data:
        Config.MYSQL_PASSWORD = data['password']
    if 'user' in data:
        Config.MYSQL_USER = data['user']
    if 'host' in data:
        Config.MYSQL_HOST = data['host']
    if 'port' in data:
        Config.MYSQL_PORT = int(data['port'])
    if 'database' in data:
        Config.MYSQL_DB = data['database']

    test_res = check_connection()
    return jsonify({
        "success": test_res.get("status") == "connected",
        "result": test_res
    })

@app.route('/api/init-db', methods=['POST'])
def api_init_db():
    try:
        res = init_database()
        return jsonify(res)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ============================================================================
# VIEW ENDPOINTS (READ FROM MYSQL)
# ============================================================================

@app.route('/api/books', methods=['GET'])
def api_get_books():
    try:
        sql = """
        SELECT 
            b.BookID,
            b.ISBN,
            b.Title,
            c.CategoryName AS Category,
            p.PublisherName AS Publisher,
            IFNULL(GROUP_CONCAT(DISTINCT a.Name SEPARATOR ', '), 'Unknown') AS Authors,
            COUNT(DISTINCT cp.CopyID) AS Total_Copies,
            COUNT(DISTINCT CASE WHEN cp.Status = 'Available' THEN cp.CopyID END) AS Available_Copies
        FROM BOOK b
        JOIN CATEGORY c ON b.CategoryID = c.CategoryID
        JOIN PUBLISHER p ON b.PublisherID = p.PublisherID
        LEFT JOIN BOOK_AUTHOR ba ON b.BookID = ba.BookID
        LEFT JOIN AUTHOR a ON ba.AuthorID = a.AuthorID
        LEFT JOIN COPY cp ON b.BookID = cp.BookID
        GROUP BY b.BookID, b.ISBN, b.Title, c.CategoryName, p.PublisherName
        ORDER BY b.BookID ASC;
        """
        books = query_db(sql)
        for b in books:
            if b.get('Authors'):
                unique_authors = list(dict.fromkeys([a.strip() for a in b['Authors'].split(',') if a.strip()]))
                b['Authors'] = ', '.join(unique_authors)
        return jsonify({"success": True, "data": books})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/members', methods=['GET'])
def api_get_members():
    try:
        sql = """
        SELECT 
            m.MemberID,
            m.Name,
            m.Email,
            m.MemberType,
            COUNT(i.IssueID) AS Total_Issued,
            IFNULL(SUM(f.Amount), 0) AS Total_Fines
        FROM MEMBER m
        LEFT JOIN ISSUE i ON m.MemberID = i.MemberID
        LEFT JOIN FINE f ON i.IssueID = f.IssueID
        GROUP BY m.MemberID, m.Name, m.Email, m.MemberType
        ORDER BY m.MemberID ASC;
        """
        members = query_db(sql)
        for m in members:
            m['Total_Fines'] = float(m['Total_Fines'])
        return jsonify({"success": True, "data": members})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/issues', methods=['GET'])
def api_get_issues():
    try:
        sql = """
        SELECT 
            i.IssueID,
            m.MemberID,
            m.Name AS Member_Name,
            b.Title AS Book_Title,
            cp.AccessionNo,
            i.IssueDate,
            i.DueDate,
            r.ReturnDate,
            CASE 
                WHEN r.ReturnDate IS NOT NULL THEN 'Returned'
                WHEN i.DueDate < CURDATE() THEN 'Overdue'
                ELSE 'Active'
            END AS Loan_Status,
            IFNULL(f.Amount, 0) AS Fine_Amount,
            IFNULL(f.PaidStatus, 'None') AS Fine_Status
        FROM ISSUE i
        JOIN MEMBER m ON i.MemberID = m.MemberID
        JOIN COPY cp ON i.CopyID = cp.CopyID
        JOIN BOOK b ON cp.BookID = b.BookID
        LEFT JOIN `RETURN` r ON i.IssueID = r.IssueID
        LEFT JOIN FINE f ON i.IssueID = f.IssueID
        ORDER BY i.IssueID DESC;
        """
        issues = query_db(sql)
        for row in issues:
            if row['IssueDate']:
                row['IssueDate'] = str(row['IssueDate'])
            if row['DueDate']:
                row['DueDate'] = str(row['DueDate'])
            if row['ReturnDate']:
                row['ReturnDate'] = str(row['ReturnDate'])
            row['Fine_Amount'] = float(row['Fine_Amount'])
        return jsonify({"success": True, "data": issues})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/digital-resources', methods=['GET'])
def api_get_digital():
    try:
        sql_res = "SELECT * FROM DIGITAL_RESOURCE ORDER BY ResourceID ASC;"
        sql_logs = """
        SELECT l.LogID, m.Name AS Member_Name, d.Title AS Resource_Title, d.Format, l.AccessDate
        FROM DIGITAL_ACCESS_LOG l
        JOIN MEMBER m ON l.MemberID = m.MemberID
        JOIN DIGITAL_RESOURCE d ON l.ResourceID = d.ResourceID
        ORDER BY l.AccessDate DESC;
        """
        resources = query_db(sql_res)
        logs = query_db(sql_logs)
        for log in logs:
            if log['AccessDate']:
                log['AccessDate'] = str(log['AccessDate'])
        return jsonify({"success": True, "resources": resources, "logs": logs})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/meta', methods=['GET'])
def api_get_meta():
    """Retrieve categories, publishers, and available copies for dropdown forms."""
    try:
        categories = query_db("SELECT CategoryID, CategoryName FROM CATEGORY ORDER BY CategoryName;")
        publishers = query_db("SELECT PublisherID, PublisherName FROM PUBLISHER ORDER BY PublisherName;")
        members = query_db("SELECT MemberID, Name, Email FROM MEMBER ORDER BY Name;")
        available_copies = query_db("""
            SELECT cp.CopyID, cp.AccessionNo, b.Title
            FROM COPY cp
            JOIN BOOK b ON cp.BookID = b.BookID
            WHERE cp.Status = 'Available'
            ORDER BY b.Title, cp.AccessionNo;
        """)
        return jsonify({
            "success": True,
            "categories": categories,
            "publishers": publishers,
            "members": members,
            "available_copies": available_copies
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ============================================================================
# THE 5 EVALUATED QUERIES ENDPOINT (EXACT FROM PORTAL)
# ============================================================================

@app.route('/api/query/<int:query_id>', methods=['GET'])
def api_run_query(query_id):
    queries = {
        1: {
            "title": "Query 1 · Books Available on Shelf",
            "desc": "Which titles still have free physical copies on the shelves?",
            "sql": "SELECT * FROM Books WHERE Available_Copies > 0;",
            "exec_sql": "SELECT * FROM Books WHERE Available_Copies > 0;"
        },
        2: {
            "title": "Query 2 · Circulation Tracking",
            "desc": "Who borrowed what, and when (Join issues with members and books)",
            "sql": """SELECT m.Member_Name, b.Title, i.Issue_Date, i.Return_Date
FROM Issued_Books i
JOIN Members m ON i.Member_ID = m.Member_ID
JOIN Books b ON i.Book_ID = b.Book_ID;""",
            "exec_sql": """SELECT m.Member_Name, b.Title, i.Issue_Date, IFNULL(i.Return_Date, 'NULL') AS Return_Date
FROM Issued_Books i
JOIN Members m ON i.Member_ID = m.Member_ID
JOIN Books b ON i.Book_ID = b.Book_ID;"""
        },
        3: {
            "title": "Query 3 · Overdue Books",
            "desc": "Books past their due date that have not been returned",
            "sql": """SELECT m.Member_Name, b.Title, i.Due_Date
FROM Issued_Books i
JOIN Members m ON i.Member_ID = m.Member_ID
JOIN Books b ON i.Book_ID = b.Book_ID
WHERE i.Return_Date IS NULL
  AND i.Due_Date < CURDATE();""",
            "exec_sql": """SELECT m.Member_Name, b.Title, i.Due_Date
FROM Issued_Books i
JOIN Members m ON i.Member_ID = m.Member_ID
JOIN Books b ON i.Book_ID = b.Book_ID
WHERE i.Return_Date IS NULL
  AND i.Due_Date < CURDATE();"""
        },
        4: {
            "title": "Query 4 · Circulation Demand",
            "desc": "How often each title is issued (grouped by book, highest first)",
            "sql": """SELECT b.Title, COUNT(*) AS Times_Issued
FROM Issued_Books i
JOIN Books b ON i.Book_ID = b.Book_ID
GROUP BY b.Book_ID
ORDER BY Times_Issued DESC;""",
            "exec_sql": """SELECT b.Title, COUNT(*) AS Times_Issued
FROM Issued_Books i
JOIN Books b ON i.Book_ID = b.Book_ID
GROUP BY b.Book_ID, b.Title
ORDER BY Times_Issued DESC;"""
        },
        5: {
            "title": "Query 5 · Financials & Member Fines",
            "desc": "Total borrowing and overdue fine fees per student member",
            "sql": """SELECT m.Member_Name, m.Member_Type, COUNT(i.Issue_ID) AS Total_Issued, SUM(f.Fine_Amount) AS Total_Fine
FROM Members m
LEFT JOIN Issued_Books i ON m.Member_ID = i.Member_ID
LEFT JOIN Fines f ON i.Issue_ID = f.Issue_ID
GROUP BY m.Member_ID
ORDER BY Total_Fine DESC;""",
            "exec_sql": """SELECT m.Member_Name, m.Member_Type, COUNT(i.Issue_ID) AS Total_Issued, CONCAT('₹', IFNULL(SUM(f.Fine_Amount), 0)) AS Total_Fine
FROM Members m
LEFT JOIN Issued_Books i ON m.Member_ID = i.Member_ID
LEFT JOIN Fines f ON i.Issue_ID = f.Issue_ID
GROUP BY m.Member_ID, m.Member_Name, m.Member_Type
ORDER BY SUM(f.Fine_Amount) DESC, Total_Issued DESC;"""
        }
    }

    if query_id not in queries:
        return jsonify({"success": False, "error": "Query ID must be between 1 and 5"}), 404

    q_info = queries[query_id]
    try:
        start_t = datetime.datetime.now()
        results = query_db(q_info["exec_sql"])
        duration = (datetime.datetime.now() - start_t).total_seconds()

        # Format dates to string
        for row in results:
            for k, v in row.items():
                if isinstance(v, (datetime.date, datetime.datetime)):
                    row[k] = str(v)

        columns = list(results[0].keys()) if results else []

        return jsonify({
            "success": True,
            "query_id": query_id,
            "title": q_info["title"],
            "description": q_info["desc"],
            "sql": q_info["sql"],
            "execution_time_sec": round(duration, 4),
            "row_count": len(results),
            "columns": columns,
            "data": results
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e), "sql": q_info["sql"]}), 500

# ============================================================================
# INSERT ENDPOINTS (WRITE TO MYSQL)
# ============================================================================

@app.route('/api/books', methods=['POST'])
def api_add_book():
    """Insert a new record into BOOK, link AUTHOR, and create physical COPY records."""
    data = request.json or {}
    title = data.get('title', '').strip()
    isbn = data.get('isbn', '').strip()
    author_name = data.get('author', '').strip()
    category_id = data.get('category_id')
    publisher_id = data.get('publisher_id')
    copies_count = int(data.get('copies', 1))

    if not title or not isbn or not category_id or not publisher_id:
        return jsonify({"success": False, "error": "Title, ISBN, Category, and Publisher are required."}), 400

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Determine new BookID
            cursor.execute("SELECT IFNULL(MAX(BookID), 200) + 1 AS next_id FROM BOOK;")
            next_id = cursor.fetchone()['next_id']

            # 2. Insert into BOOK
            cursor.execute("""
                INSERT INTO BOOK (BookID, ISBN, Title, CategoryID, PublisherID)
                VALUES (%s, %s, %s, %s, %s);
            """, (next_id, isbn, title, category_id, publisher_id))

            # 3. Handle Author
            if author_name:
                cursor.execute("SELECT AuthorID FROM AUTHOR WHERE Name = %s;", (author_name,))
                author_row = cursor.fetchone()
                if author_row:
                    author_id = author_row['AuthorID']
                else:
                    cursor.execute("INSERT INTO AUTHOR (Name, Country) VALUES (%s, 'General');", (author_name,))
                    author_id = cursor.lastrowid
                cursor.execute("INSERT INTO BOOK_AUTHOR (BookID, AuthorID) VALUES (%s, %s);", (next_id, author_id))

            # 4. Insert physical copies
            for i in range(1, copies_count + 1):
                acc_no = f"ACC-{next_id}-{i}"
                cursor.execute("""
                    INSERT INTO COPY (AccessionNo, BookID, Status)
                    VALUES (%s, %s, 'Available');
                """, (acc_no, next_id))

        return jsonify({
            "success": True,
            "message": f"Book '{title}' created successfully with {copies_count} available physical copies (BookID: {next_id}).",
            "book_id": next_id
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/members', methods=['POST'])
def api_add_member():
    """Insert a new record into MEMBER."""
    data = request.json or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    member_type = data.get('member_type', 'Student').strip()

    if not name or not email:
        return jsonify({"success": False, "error": "Member Name and Email are required."}), 400

    try:
        res = modify_db("""
            INSERT INTO MEMBER (Name, Email, MemberType)
            VALUES (%s, %s, %s);
        """, (name, email, member_type))
        return jsonify({
            "success": True,
            "message": f"Member '{name}' registered successfully with MemberID: {res['last_id']}.",
            "member_id": res['last_id']
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/issues', methods=['POST'])
def api_issue_book():
    """Issue a physical copy to a member and update copy status to 'Issued'."""
    data = request.json or {}
    member_id = data.get('member_id')
    copy_id = data.get('copy_id')
    days_valid = int(data.get('days', 14))

    if not member_id or not copy_id:
        return jsonify({"success": False, "error": "Member and Copy selections are required."}), 400

    issue_date = datetime.date.today()
    due_date = issue_date + datetime.timedelta(days=days_valid)

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Check if copy is still available
            cursor.execute("SELECT Status, AccessionNo FROM COPY WHERE CopyID = %s;", (copy_id,))
            c_row = cursor.fetchone()
            if not c_row or c_row['Status'] != 'Available':
                return jsonify({"success": False, "error": "Selected copy is no longer available on the shelf."}), 400

            # Insert ISSUE record
            cursor.execute("""
                INSERT INTO ISSUE (MemberID, CopyID, IssueDate, DueDate)
                VALUES (%s, %s, %s, %s);
            """, (member_id, copy_id, issue_date, due_date))
            issue_id = cursor.lastrowid

            # Update COPY status
            cursor.execute("UPDATE COPY SET Status = 'Issued' WHERE CopyID = %s;", (copy_id,))

        return jsonify({
            "success": True,
            "message": f"Copy {c_row['AccessionNo']} issued successfully (Issue ID: {issue_id}, Due Date: {due_date}).",
            "issue_id": issue_id
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()

# ============================================================================
# DELETE / RETURN ENDPOINTS (UPDATE OR REMOVE FROM MYSQL)
# ============================================================================

@app.route('/api/books/<int:book_id>', methods=['DELETE'])
def api_delete_book(book_id):
    """Delete a book record and cascade delete its copies and relations."""
    try:
        book = query_db("SELECT Title FROM BOOK WHERE BookID = %s;", (book_id,), one=True)
        if not book:
            return jsonify({"success": False, "error": f"Book with ID {book_id} does not exist."}), 404

        title = book['Title']
        modify_db("DELETE FROM BOOK WHERE BookID = %s;", (book_id,))
        return jsonify({
            "success": True,
            "message": f"Book '{title}' (ID: {book_id}) and all associated shelf copies deleted from database successfully."
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/members/<int:member_id>', methods=['DELETE'])
def api_delete_member(member_id):
    """Delete a member record."""
    try:
        member = query_db("SELECT Name FROM MEMBER WHERE MemberID = %s;", (member_id,), one=True)
        if not member:
            return jsonify({"success": False, "error": f"Member with ID {member_id} does not exist."}), 404

        name = member['Name']
        modify_db("DELETE FROM MEMBER WHERE MemberID = %s;", (member_id,))
        return jsonify({
            "success": True,
            "message": f"Member '{name}' (ID: {member_id}) removed from database."
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/return/<int:issue_id>', methods=['POST'])
def api_return_book(issue_id):
    """Process return: insert into RETURN, update COPY to Available, create FINE if late."""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Fetch issue details
            cursor.execute("""
                SELECT i.IssueID, i.CopyID, i.DueDate, r.ReturnID
                FROM ISSUE i
                LEFT JOIN `RETURN` r ON i.IssueID = r.IssueID
                WHERE i.IssueID = %s;
            """, (issue_id,))
            row = cursor.fetchone()
            if not row:
                return jsonify({"success": False, "error": "Issue transaction not found."}), 404
            if row['ReturnID']:
                return jsonify({"success": False, "error": "This book issue has already been marked returned."}), 400

            today = datetime.date.today()
            due_date = row['DueDate']

            # 2. Insert into RETURN
            cursor.execute("INSERT INTO `RETURN` (IssueID, ReturnDate) VALUES (%s, %s);", (issue_id, today))

            # 3. Update COPY status to Available
            cursor.execute("UPDATE COPY SET Status = 'Available' WHERE CopyID = %s;", (row['CopyID'],))

            # 4. Check for overdue fine (e.g. ₹5 per overdue day)
            fine_amount = 0.0
            if today > due_date:
                overdue_days = (today - due_date).days
                fine_amount = round(overdue_days * 5.0, 2)
                cursor.execute("""
                    INSERT INTO FINE (IssueID, Amount, PaidStatus)
                    VALUES (%s, %s, 'Unpaid')
                    ON DUPLICATE KEY UPDATE Amount = %s;
                """, (issue_id, fine_amount, fine_amount))

        msg = f"Issue #{issue_id} successfully closed and copy restored to shelf."
        if fine_amount > 0:
            msg += f" Late fee of ₹{fine_amount} recorded."

        return jsonify({"success": True, "message": msg, "fine_recorded": fine_amount})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
