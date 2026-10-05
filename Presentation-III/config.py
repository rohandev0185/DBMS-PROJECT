import os

class Config:
    MYSQL_HOST = os.environ.get('MYSQL_HOST', 'localhost')
    MYSQL_PORT = int(os.environ.get('MYSQL_PORT', 3306))
    MYSQL_USER = os.environ.get('MYSQL_USER', 'root')
    MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', '(Destroyer)123')
    MYSQL_DB = os.environ.get('MYSQL_DB', 'LibraryDBMS')
    SECRET_KEY = os.environ.get('SECRET_KEY', 'woxsen-dbms-project-rohan-25wu0101112')
