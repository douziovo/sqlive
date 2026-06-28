-- =============================================
-- SQLite 多表查询测试 SQL（含索引）
-- =============================================

-- 1. 部门表
CREATE TABLE departments
(
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL,
    location TEXT,
    budget   REAL DEFAULT 0
);

-- 2. 员工表（外键关联部门）
CREATE TABLE employees
(
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    age       INTEGER CHECK (age > 0 AND age < 100),
    salary    REAL    NOT NULL,
    dept_id   INTEGER NOT NULL,
    hire_date TEXT    NOT NULL,
    email     TEXT UNIQUE
);

-- 3. 项目表
CREATE TABLE projects
(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    start_date TEXT,
    end_date   TEXT,
    budget     REAL
);

-- 4. 员工-项目 多对多关联表
CREATE TABLE employee_projects
(
    emp_id     INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    role       TEXT,
    hours      INTEGER DEFAULT 0,
    PRIMARY KEY (emp_id, project_id)
);

-- =============================================
-- 索引
-- =============================================

-- 单列索引：按部门查员工
CREATE INDEX idx_employees_dept ON employees (dept_id);

-- 唯一索引：邮箱唯一
CREATE UNIQUE INDEX idx_employees_email ON employees (email);

-- 复合索引：按部门和薪资范围查询
CREATE INDEX idx_employees_dept_salary ON employees (dept_id, salary);

-- 按入职日期排序查询
CREATE INDEX idx_employees_hire_date ON employees (hire_date);

-- 关联表索引
CREATE INDEX idx_emp_proj_project ON employee_projects (project_id);

-- 表达式索引（SQLite 3.9+ 支持）：按员工姓名小写搜索
CREATE INDEX idx_employees_name_lower ON employees (LOWER(name));

-- 部分索引：仅高薪员工
CREATE INDEX idx_employees_high_salary ON employees (salary) WHERE salary > 10000;

-- =============================================
-- SQLite 全数据类型演示表
-- =============================================

CREATE TABLE type_demo
(
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,

    -- 存储类：INTEGER
    col_integer          INTEGER,
    col_int              INT,
    col_tinyint          TINYINT,
    col_smallint         SMALLINT,
    col_mediumint        MEDIUMINT,
    col_bigint           BIGINT,
    col_int2             INT2,
    col_int8             INT8,
    col_unsigned_big_int UNSIGNED BIG INT,

    -- 存储类：REAL
    col_real             REAL,
    col_double DOUBLE,
    col_double_precision DOUBLE PRECISION,
    col_float            FLOAT,

    -- 存储类：TEXT
    col_text             TEXT,
    col_character        CHARACTER(20),
    col_varchar          VARCHAR(50),
    col_varying_character VARYING CHARACTER(30),
    col_nchar            NCHAR(10),
    col_native_character NATIVE CHARACTER(20),
    col_nvarchar         NVARCHAR(40),
    col_clob             CLOB,

    -- 存储类：NUMERIC
    col_numeric          NUMERIC,
    col_decimal          DECIMAL(10, 2),
    col_boolean          BOOLEAN,
    col_date             DATE,
    col_datetime         DATETIME,

    -- 存储类：BLOB
    col_blob             BLOB,

    -- 约束组合
    col_not_null         TEXT NOT NULL DEFAULT 'default_val',
    col_unique           TEXT UNIQUE,
    col_check            INTEGER CHECK (col_check >= 0)
);

-- =============================================
-- 视图
-- =============================================

-- 员工完整信息视图（跨3表 JOIN）
CREATE VIEW v_employee_full AS
SELECT e.id                       AS emp_id,
       e.name                     AS emp_name,
       e.age,
       e.salary,
       e.hire_date,
       d.name                     AS dept_name,
       d.location                 AS dept_location,
       COUNT(ep.project_id)       AS project_count,
       COALESCE(SUM(ep.hours), 0) AS total_hours
FROM employees e
         JOIN departments d ON e.dept_id = d.id
         LEFT JOIN employee_projects ep ON e.id = ep.emp_id
GROUP BY e.id;

-- 项目概览视图
CREATE VIEW v_project_summary AS
SELECT p.id,
       p.name,
       p.start_date,
       p.end_date,
       p.budget,
       COUNT(ep.emp_id)                                 AS member_count,
       COALESCE(SUM(ep.hours), 0)                       AS total_work_hours,
       ROUND(p.budget / NULLIF(COUNT(ep.emp_id), 0), 2) AS budget_per_member
FROM projects p
         LEFT JOIN employee_projects ep ON p.id = ep.project_id
GROUP BY p.id;

-- 部门薪资统计视图
CREATE VIEW v_dept_salary_stats AS
SELECT d.name,
       COUNT(e.id)             AS emp_count,
       ROUND(MIN(e.salary), 2) AS min_salary,
       ROUND(MAX(e.salary), 2) AS max_salary,
       ROUND(AVG(e.salary), 2) AS avg_salary,
       ROUND(SUM(e.salary), 2) AS total_salary
FROM departments d
         LEFT JOIN employees e ON d.id = e.dept_id
GROUP BY d.id;

-- 高薪员工视图
CREATE VIEW v_high_salary_employees AS
SELECT e.name, e.salary, d.name AS dept_name
FROM employees e
         JOIN departments d ON e.dept_id = d.id
WHERE e.salary > 15000
ORDER BY e.salary DESC;

-- =============================================
-- 触发器
-- =============================================

-- 审计日志表
CREATE TABLE audit_log
(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    operation  TEXT NOT NULL,
    old_data   TEXT,
    new_data   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 员工插入触发器：自动记录审计日志
CREATE TRIGGER trg_employees_insert
    AFTER INSERT
    ON employees
BEGIN
    INSERT INTO audit_log (table_name, operation, new_data)
    VALUES ('employees', 'INSERT',
            'id=' || NEW.id || ', name=' || NEW.name || ', salary=' || NEW.salary);
END;

-- 员工更新触发器：记录变更前后数据
CREATE TRIGGER trg_employees_update
    AFTER UPDATE
    ON employees
BEGIN
    INSERT INTO audit_log (table_name, operation, old_data, new_data)
    VALUES ('employees', 'UPDATE',
            'name=' || OLD.name || ', salary=' || OLD.salary,
            'name=' || NEW.name || ', salary=' || NEW.salary);
END;

-- 员工删除触发器：记录被删除的数据
CREATE TRIGGER trg_employees_delete
    AFTER DELETE
    ON employees
BEGIN
    INSERT INTO audit_log (table_name, operation, old_data)
    VALUES ('employees', 'DELETE',
            'id=' || OLD.id || ', name=' || OLD.name || ', salary=' || OLD.salary);
END;

-- BEFORE 触发器：自动设置项目结束日期（如果未指定则设为开始日期后1年）
CREATE TRIGGER trg_projects_default_end_date
    BEFORE INSERT
    ON projects
BEGIN
    UPDATE projects
    SET end_date = CASE
                       WHEN NEW.end_date IS NULL AND NEW.start_date IS NOT NULL
                           THEN date (NEW.start_date, '+1 year')
        ELSE NEW.end_date
END WHERE id = NEW.id;
END;

-- BEFORE 触发器：薪资校验（不允许低于最低工资）
CREATE TRIGGER trg_employees_salary_check
    BEFORE INSERT
    ON employees
BEGIN
    SELECT CASE
               WHEN NEW.salary < 3000 THEN RAISE(ABORT, '薪资不能低于 3000')
               END;
END;

-- =============================================
-- 数据
-- =============================================

INSERT INTO departments
VALUES (1, '技术部', '北京', 500000);
INSERT INTO departments
VALUES (2, '市场部', '上海', 300000);
INSERT INTO departments
VALUES (3, '人事部', '广州', 150000);
INSERT INTO departments
VALUES (4, '财务部', '深圳', 200000);

INSERT INTO employees
VALUES (1, '张三', 28, 15000, 1, '2020-03-15', 'zhangsan@example.com');
INSERT INTO employees
VALUES (2, '李四', 32, 18000, 1, '2019-07-01', 'lisi@example.com');
INSERT INTO employees
VALUES (3, '王五', 26, 12000, 1, '2021-01-10', 'wangwu@example.com');
INSERT INTO employees
VALUES (4, '赵六', 35, 20000, 2, '2018-05-20', 'zhaoliu@example.com');
INSERT INTO employees
VALUES (5, '孙七', 29, 9500, 2, '2020-11-01', 'sunqi@example.com');
INSERT INTO employees
VALUES (6, '周八', 40, 22000, 3, '2017-02-14', 'zhouba@example.com');
INSERT INTO employees
VALUES (7, '吴九', 24, 8000, 3, '2022-06-30', 'wujiu@example.com');
INSERT INTO employees
VALUES (8, '郑十', 31, 17000, 4, '2019-09-09', 'zhengshi@example.com');

INSERT INTO projects
VALUES (1, '云平台重构', '2022-01-01', '2022-12-31', 200000);
INSERT INTO projects
VALUES (2, '移动App开发', '2022-03-01', '2023-06-30', 150000);
INSERT INTO projects
VALUES (3, '数据分析系统', '2022-06-01', NULL, 100000);

INSERT INTO employee_projects
VALUES (1, 1, '架构师', 120);
INSERT INTO employee_projects
VALUES (2, 1, '后端开发', 200);
INSERT INTO employee_projects
VALUES (3, 1, '前端开发', 180);
INSERT INTO employee_projects
VALUES (1, 2, '技术顾问', 60);
INSERT INTO employee_projects
VALUES (4, 2, '产品经理', 100);
INSERT INTO employee_projects
VALUES (5, 2, 'UI设计', 160);
INSERT INTO employee_projects
VALUES (2, 3, '数据工程师', 150);
INSERT INTO employee_projects
VALUES (6, 3, '数据分析师', 120);

-- 类型演示数据
INSERT INTO type_demo (col_integer, col_int, col_tinyint, col_smallint, col_mediumint, col_bigint,
                       col_real, col_double, col_float,
                       col_text, col_character, col_varchar, col_nchar, col_nvarchar, col_clob,
                       col_numeric, col_decimal, col_boolean, col_date, col_datetime,
                       col_blob,
                       col_not_null, col_unique, col_check)
VALUES (42, -100, 127, 32767, 8388607, 9223372036854775807,
        3.141592653589793, 2.718281828459045, 1.4142135623730951,
        'Hello SQLite', 'CHAR text', 'VARCHAR text', 'NCHAR', 'NVARCHAR text', 'CLOB long text data here',
        99.99, 12345.67, 1, '2024-01-15', '2024-06-20 14:30:00',
        X'DEADBEEF',
        'not null value', 'unique_value_1', 100);

INSERT INTO type_demo (col_integer, col_int, col_bigint,
                       col_real, col_double,
                       col_text, col_varchar, col_nvarchar,
                       col_numeric, col_decimal, col_boolean, col_date, col_datetime,
                       col_not_null, col_unique, col_check)
VALUES (NULL, NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL,
        NULL, NULL, 0, NULL, NULL,
        'nullable test', 'unique_value_2', 0);

-- =============================================
-- 多表查询
-- =============================================

-- Q1: INNER JOIN — 员工+部门
SELECT e.name AS 员工, d.name AS 部门, e.salary AS 薪资
FROM employees e
         INNER JOIN departments d ON e.dept_id = d.id;

-- Q2: LEFT JOIN — 所有员工参与项目情况
SELECT e.name, p.name AS project, ep.role
FROM employees e
         LEFT JOIN employee_projects ep ON e.id = ep.emp_id
         LEFT JOIN projects p ON ep.project_id = p.id;

-- Q3: 聚合 + GROUP BY — 部门平均薪资
SELECT d.name, COUNT(e.id) AS 人数, ROUND(AVG(e.salary), 2) AS 平均薪资
FROM departments d
         LEFT JOIN employees e ON d.id = e.dept_id
GROUP BY d.id
HAVING 平均薪资 > 10000;

-- Q4: 子查询 — 薪资高于部门平均的员工
SELECT e.name, e.salary, d.name AS dept
FROM employees e
         JOIN departments d ON e.dept_id = d.id
WHERE e.salary > (SELECT AVG(e2.salary)
                  FROM employees e2
                  WHERE e2.dept_id = e.dept_id);

-- Q5: 三表 JOIN — 项目成员明细
SELECT p.name AS 项目, e.name AS 员工, ep.role AS 角色, ep.hours AS 工时
FROM employee_projects ep
         JOIN employees e ON ep.emp_id = e.id
         JOIN projects p ON ep.project_id = p.id
ORDER BY p.name, ep.hours DESC;

-- Q6: EXISTS 子查询 — 有参与项目的员工
SELECT e.name, d.name AS dept
FROM employees e
         JOIN departments d ON e.dept_id = d.id
WHERE EXISTS (SELECT 1
              FROM employee_projects ep
              WHERE ep.emp_id = e.id);

-- Q7: UNION — 各部门薪资最高和最低的员工
SELECT e.name, e.salary, d.name AS dept, '最高' AS 类型
FROM employees e
         JOIN departments d ON e.dept_id = d.id
WHERE (e.dept_id, e.salary) IN (SELECT dept_id, MAX(salary)
                                FROM employees
                                GROUP BY dept_id)
UNION ALL
SELECT e.name, e.salary, d.name, '最低'
FROM employees e
         JOIN departments d ON e.dept_id = d.id
WHERE (e.dept_id, e.salary) IN (SELECT dept_id, MIN(salary)
                                FROM employees
                                GROUP BY dept_id)
ORDER BY dept, 类型;

-- Q8: 窗口函数（SQLite 3.25+）— 部门内薪资排名
SELECT e.name,
       d.name AS dept,
       e.salary,
       RANK()    OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC) AS 排名
FROM employees e
         JOIN departments d ON e.dept_id = d.id;

-- =============================================
-- DML：UPDATE / DELETE / REPLACE (UPSERT)
-- =============================================

-- 涨薪：技术部全员涨 10%
UPDATE employees
SET salary = ROUND(salary * 1.1, 2)
WHERE dept_id = 1;

-- 删除已完成项目（有 end_date 且在 2023 年之前）
DELETE
FROM employee_projects
WHERE project_id IN (SELECT id
                     FROM projects
                     WHERE end_date < '2023-01-01');

-- UPSERT：冲突时更新薪资
INSERT INTO employees (id, name, age, salary, dept_id, hire_date, email)
VALUES (1, '张三', 29, 16500, 1, '2020-03-15', 'zhangsan@example.com') ON CONFLICT(id) DO
UPDATE SET salary = excluded.salary, age = excluded.age;

-- INSERT INTO ... SELECT：从高薪视图复制到新表
CREATE TABLE high_salary_backup
(
    emp_name  TEXT,
    salary    REAL,
    dept_name TEXT
);
INSERT INTO high_salary_backup
SELECT *
FROM v_high_salary_employees;

-- =============================================
-- CTE (WITH) / 递归 CTE
-- =============================================

-- 普通 CTE：各部门薪资总和 + 全局排名
WITH dept_total AS (SELECT dept_id, SUM(salary) AS total_salary
                    FROM employees
                    GROUP BY dept_id)
SELECT d.name,
       dt.total_salary,
       RANK() OVER (ORDER BY dt.total_salary DESC) AS 排名
FROM dept_total dt
         JOIN departments d ON d.id = dt.dept_id;

-- 多 CTE 链式引用
WITH avg_sal AS (SELECT dept_id, AVG(salary) AS avg_salary FROM employees GROUP BY dept_id),
     above_avg AS (SELECT e.name, e.salary, e.dept_id, a.avg_salary
                   FROM employees e
                            JOIN avg_sal a ON e.dept_id = a.dept_id
                   WHERE e.salary > a.avg_salary)
SELECT d.name AS 部门, aa.name AS 员工, aa.salary, ROUND(aa.avg_salary, 2) AS 部门均薪
FROM above_avg aa
         JOIN departments d ON aa.dept_id = d.id
ORDER BY d.name, aa.salary DESC;

-- 递归 CTE：生成 1 到 50 的数字序列
WITH RECURSIVE seq(n) AS (SELECT 1
                          UNION ALL
                          SELECT n + 1
                          FROM seq
                          WHERE n < 50)
SELECT n, n * n AS 平方, HEX(n) AS 十六进制
FROM seq;

-- 递归 CTE：斐波那契数列
WITH RECURSIVE fib(a, b, n) AS (SELECT 0, 1, 0
                                UNION ALL
                                SELECT b, a + b, n + 1
                                FROM fib
                                WHERE n < 20)
SELECT n, a AS fib_value
FROM fib;

-- 递归 CTE：组织树（部门层级）
CREATE TABLE org_tree
(
    id        INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    parent_id INTEGER REFERENCES org_tree (id)
);
INSERT INTO org_tree
VALUES (1, '总公司', NULL);
INSERT INTO org_tree
VALUES (2, '技术部', 1);
INSERT INTO org_tree
VALUES (3, '前端组', 2);
INSERT INTO org_tree
VALUES (4, '后端组', 2);
INSERT INTO org_tree
VALUES (5, '市场部', 1);

WITH RECURSIVE org_path(id, name, path, level) AS (SELECT id, name, name, 0
                                                   FROM org_tree
                                                   WHERE parent_id IS NULL
                                                   UNION ALL
                                                   SELECT t.id, t.name, op.path || ' > ' || t.name, op.level + 1
                                                   FROM org_tree t
                                                            JOIN org_path op ON t.parent_id = op.id)
SELECT id, path AS 组织路径, level AS 层级
FROM org_path
ORDER BY id;

-- =============================================
-- 集合操作：INTERSECT / EXCEPT
-- =============================================

-- INTERSECT：同时参与项目 1 和项目 2 的员工
SELECT emp_id
FROM employee_projects
WHERE project_id = 1
INTERSECT
SELECT emp_id
FROM employee_projects
WHERE project_id = 2;

-- EXCEPT：只参与项目 1 但未参与项目 2 的员工
SELECT emp_id
FROM employee_projects
WHERE project_id = 1
EXCEPT
SELECT emp_id
FROM employee_projects
WHERE project_id = 2;

-- =============================================
-- 全部窗口函数
-- =============================================

-- ROW_NUMBER / RANK / DENSE_RANK / NTILE
SELECT e.name,
       d.name AS    dept,
       e.salary,
       ROW_NUMBER() OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC) AS row_num, RANK() OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC) AS rank_no, DENSE_RANK() OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC) AS dense_rnk, NTILE(2) OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC) AS ntile_2
FROM employees e
         JOIN departments d ON e.dept_id = d.id;

-- LAG / LEAD：与前/后一名员工的薪资差
SELECT e.name,
       e.salary,
       LAG(e.salary, 1, 0) OVER (ORDER BY e.salary DESC) AS prev_salary, LEAD(e.salary, 1, 0) OVER (ORDER BY e.salary DESC) AS next_salary, e.salary - LAG(e.salary, 1, 0) OVER (ORDER BY e.salary DESC) AS diff_prev
FROM employees e;

-- FIRST_VALUE / LAST_VALUE / NTH_VALUE
SELECT e.name,
       d.name AS           dept,
       e.salary,
       FIRST_VALUE(e.name) OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC) AS 最高薪者, LAST_VALUE(e.name) OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS 最低薪者
FROM employees e
         JOIN departments d ON e.dept_id = d.id;

-- 累积分布：CUME_DIST / PERCENT_RANK
SELECT name,
       salary,
       ROUND(CUME_DIST() OVER (ORDER BY salary), 3)    AS 累计分布,
       ROUND(PERCENT_RANK() OVER (ORDER BY salary), 3) AS 百分比排名
FROM employees;

-- =============================================
-- JOIN 全类型
-- =============================================

-- CROSS JOIN：部门 × 项目（所有组合）
SELECT d.name AS 部门, p.name AS 项目
FROM departments d
         CROSS JOIN projects p;

-- SELF JOIN：找出薪资高于同部门所有人的员工（用 EXISTS 改写也可）
SELECT e1.name, e1.salary, e2.name AS 更高薪者
FROM employees e1
         LEFT JOIN employees e2 ON e1.dept_id = e2.dept_id AND e2.salary > e1.salary
WHERE e2.id IS NULL;

-- NATURAL JOIN（列名相同时自动关联）
CREATE TABLE dept_budget
(
    id           INTEGER PRIMARY KEY,
    budget_limit REAL
);
INSERT INTO dept_budget
VALUES (1, 600000),
       (2, 400000),
       (3, 200000),
       (4, 300000);
SELECT *
FROM departments
         NATURAL JOIN dept_budget;

-- =============================================
-- 子查询全类型
-- =============================================

-- 标量子查询（SELECT 子句中）
SELECT name,
       salary,
       (SELECT ROUND(AVG(salary), 2) FROM employees)          AS 全员均薪,
       ROUND(salary - (SELECT AVG(salary) FROM employees), 2) AS 与均值差额
FROM employees;

-- 派生表（FROM 子句中）
SELECT dept, MAX(salary) AS 最高薪
FROM (SELECT e.name, e.salary, d.name AS dept
      FROM employees e
               JOIN departments d ON e.dept_id = d.id)
GROUP BY dept;

-- 多列子查询
SELECT name, dept_id, salary
FROM employees
WHERE (dept_id, salary) IN (SELECT dept_id, MAX(salary)
                            FROM employees
                            GROUP BY dept_id);

-- NOT IN 子查询
SELECT name
FROM employees
WHERE id NOT IN (SELECT DISTINCT emp_id FROM employee_projects);

-- ALL / ANY 子查询
SELECT name, salary
FROM employees
WHERE salary > (SELECT MAX(salary) FROM employees WHERE dept_id = 2);

-- =============================================
-- NULL 处理函数
-- =============================================

SELECT NULLIF(10, 10)                           AS 相等返回NULL, -- NULL
       NULLIF(10, 20)                           AS 不等返回原值, -- 10
       IFNULL(NULL, '默认值')                   AS ifnull示例,   -- '默认值'
       COALESCE(NULL, NULL, '第三值', '第四值') AS coalesce示例,
       IFNULL(NULL, NULL)                       AS 两级ifnull,
       COALESCE(end_date, '进行中')             AS 项目状态
FROM projects;

-- IS NULL / IS NOT NULL
SELECT name,
       end_date,
       CASE WHEN end_date IS NULL THEN '进行中' ELSE '已完成' END AS 状态
FROM projects;

-- =============================================
-- 字符串函数
-- =============================================

SELECT UPPER('hello')                AS 大写,
       LOWER('WORLD')                AS 小写,
       LENGTH('SQLite')              AS 长度,
       SUBSTR('Hello World', 1, 5)   AS 截取,
       REPLACE('a-b-c', '-', '/')    AS 替换,
       TRIM('  hello  ')             AS 去空格,
       LTRIM('  left')               AS 去左空格,
       RTRIM('right  ')              AS 去右空格,
       INSTR('hello world', 'world') AS 位置,
       'Hello' || ' ' || 'SQLite'    AS 拼接,
       X'48656C6C6F'                 AS blob字面量;

-- LIKE / GLOB 模式匹配
SELECT name
FROM employees
WHERE name LIKE '张%';
SELECT name
FROM employees
WHERE name LIKE '李_';
SELECT name
FROM employees
WHERE name GLOB '[周吴郑王]*';

-- =============================================
-- 日期时间函数
-- =============================================

SELECT
    date ('now') AS 今天日期, time ('now') AS 当前时间, datetime('now') AS 当前日期时间, datetime('now', '+1 day') AS 明天, datetime('now', '-7 days') AS 一周前, datetime('now', 'start of month') AS 月初, datetime('now', 'start of year') AS 年初, datetime('now', 'weekday 0') AS 本周日, strftime('%Y-%m-%d %H:%M:%S', 'now') AS 格式化, strftime('%w', 'now') AS 周几, strftime('%j', 'now') AS 年第几天, julianday('now') AS 儒略日, unixepoch('now') AS unix时间戳;

-- 日期计算
SELECT hire_date,
       julianday('now') - julianday(hire_date) AS 入职天数
FROM employees;

-- =============================================
-- 数学 / 聚合函数
-- =============================================

SELECT ABS(-42)          AS 绝对值,
       ROUND(3.14159, 3) AS 四舍五入,
       RANDOM() % 100 AS 随机数,
    MAX(salary) AS 最高薪,
    MIN(salary) AS 最低薪
FROM employees;

-- 聚合函数
SELECT COUNT(*)                 AS 总数,
       COUNT(DISTINCT dept_id)  AS 部门数,
       SUM(salary)              AS 薪资总和,
       ROUND(AVG(salary), 2)    AS 平均薪,
       TOTAL(salary)            AS total函数,
       GROUP_CONCAT(name, ', ') AS 所有人名
FROM employees;

-- GROUP_CONCAT + ORDER BY
SELECT d.name,
       GROUP_CONCAT(e.name, ' | ') AS 成员
FROM departments d
         LEFT JOIN employees e ON d.id = e.dept_id
GROUP BY d.id;

-- =============================================
-- CASE 表达式
-- =============================================

SELECT name,
       salary,
       CASE
           WHEN salary >= 20000 THEN '高薪'
           WHEN salary >= 12000 THEN '中等'
           ELSE '普通'
           END AS 薪资等级
FROM employees
ORDER BY salary DESC;

-- =============================================
-- DISTINCT / LIMIT / OFFSET
-- =============================================

SELECT DISTINCT dept_id
FROM employees;
SELECT *
FROM employees
ORDER BY salary DESC LIMIT 3;
SELECT *
FROM employees
ORDER BY id LIMIT 3
OFFSET 2;

-- =============================================
-- ALTER TABLE
-- =============================================

ALTER TABLE departments
    ADD COLUMN established_date TEXT;
ALTER TABLE org_tree RENAME TO org_hierarchy;

-- =============================================
-- CREATE TABLE AS SELECT
-- =============================================

CREATE TABLE dept_summary AS
SELECT d.name                  AS dept_name,
       COUNT(e.id)             AS emp_count,
       ROUND(AVG(e.salary), 2) AS avg_salary
FROM departments d
         LEFT JOIN employees e ON d.id = e.dept_id
GROUP BY d.id;

-- =============================================
-- 复杂表级约束
-- =============================================

CREATE TABLE products
(
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    sku      TEXT    NOT NULL,
    name     TEXT    NOT NULL,
    price    REAL    NOT NULL CHECK (price > 0),
    stock    INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    category TEXT,
    UNIQUE (sku),
    CONSTRAINT price_stock_check CHECK (price > 0 OR stock = 0)
);

-- =============================================
-- 高级触发器
-- =============================================

-- 有 WHEN 条件的触发器
CREATE TRIGGER trg_high_salary_alert
    AFTER INSERT
    ON employees
    WHEN NEW.salary > 20000
BEGIN
    INSERT INTO audit_log (table_name, operation, new_data)
    VALUES ('employees', 'HIGH_SALARY_ALERT',
            '高薪员工: ' || NEW.name || ' 薪资: ' || NEW.salary);
END;

-- UPDATE OF 特定列触发器
CREATE TRIGGER trg_employees_salary_change
    AFTER UPDATE OF salary
    ON employees
BEGIN
    INSERT INTO audit_log (table_name, operation, old_data, new_data)
    VALUES ('employees', 'SALARY_CHANGE',
            OLD.name || ' 原薪资:' || OLD.salary,
            NEW.name || ' 新薪资:' || NEW.salary);
END;

-- 多数据插入测试（验证触发器不会因解析器被截断）
INSERT INTO employees (name, age, salary, dept_id, hire_date, email)
VALUES ('新员工A', 25, 25000, 2, '2025-01-01', 'newA@example.com');
INSERT INTO employees (name, age, salary, dept_id, hire_date, email)
VALUES ('新员工B', 22, 5000, 3, '2025-02-01', 'newB@example.com');
